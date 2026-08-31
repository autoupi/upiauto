import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

// Exponential backoff schedule (seconds) — index = attempt number (1-based)
const BACKOFF_SECONDS = [10, 30, 120, 600, 1800, 3600, 10800, 21600];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length; // ~9 hours total

function eventFor(status: string) {
  if (status === "paid") return "payment.success";
  if (status === "expired") return "payment.expired";
  if (status === "failed") return "payment.failed";
  return null;
}

async function handler() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // First also expire stale pending orders so they get a webhook
  await supabase
    .from("orders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expiry_at", new Date().toISOString());

  // Find orders due for webhook delivery
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("orders")
    .select(

"order_id,merchant_id,merchant_order_id,status,requested_amount,payable_amount,paid_at,failed_at,payer_email,webhook_url,webhook_attempts,webhook_status",).eq("webhook_status", "pending") .not("webhook_url", "is", null) .in("status", ["paid", "expired", "failed"]) .lte("next_webhook_at", nowIso)




     .limit(20);

  if (!due || due.length === 0) {
    return Response.json({ dispatched: 0 });
  }

  // Load merchant secrets
  const merchantIds = [...new Set(due.map((o) => o.merchant_id).filter(Boolean))] as string[];
  const { data: merchants } = await supabase
    .from("merchants")
    .select("id,webhook_secret")
    .in("id", merchantIds);
  const secretById = new Map((merchants ?? []).map((m) => [m.id, m.webhook_secret]));

  const results: any[] = [];

  for (const o of due) {
    const event = eventFor(o.status);
    if (!event || !o.webhook_url || !o.merchant_id) {
      await supabase
        .from("orders")
        .update({ webhook_status: "skipped" })
        .eq("order_id", o.order_id);
      continue;
    }
    const secret = secretById.get(o.merchant_id);
    if (!secret) {
      await supabase
        .from("orders")
        .update({ webhook_status: "failed" })
        .eq("order_id", o.order_id);
      continue;
    }

     const attempt = (o.webhook_attempts ?? 0) + 1;
     const payload = {
       event,
       order_id: o.order_id,
       merchant_order_id: o.merchant_order_id,
       amount: Number(o.requested_amount),
       payable_amount: Number(o.payable_amount),
       paid_at: o.paid_at,
       failed_at: o.failed_at,
       payer_email: o.payer_email,
       attempt,
     };
     const body = JSON.stringify(payload);
     const t = Math.floor(Date.now() / 1000);
     const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
     const signature = `t=${t},v1=${v1}`;
     const webhookId = `${o.order_id}-${attempt}`;

     let statusCode: number | null = null;
     let responseBody = "";
     let errorMsg: string | null = null;

     try {
       const controller = new AbortController();
       const timeout = setTimeout(() => controller.abort(), 8000);
       const res = await fetch(o.webhook_url, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "X-Signature": signature,
           "X-Webhook-Id": webhookId,
           "X-Event": event,
           "User-Agent": "AutoUPI-Webhook/1.0",
         },
         body,
         signal: controller.signal,
       }).finally(() => clearTimeout(timeout));
       statusCode = res.status;
       responseBody = (await res.text()).slice(0, 2000);
     } catch (e: any) {
       errorMsg = e.message ?? String(e);
     }

     await supabase.from("webhook_deliveries").insert({
       order_id: o.order_id,
       attempt,
       event,
       url: o.webhook_url,
       status_code: statusCode,
       response_body: responseBody,
       error: errorMsg,
     });

     const ok = statusCode !== null && statusCode >= 200 && statusCode < 300;
     if (ok) {
       await supabase
         .from("orders")
         .update({
           webhook_status: "delivered",
           webhook_attempts: attempt,




              last_webhook_at: new Date().toISOString(),
            })
            .eq("order_id", o.order_id);
          results.push({ order_id: o.order_id, status: "delivered", attempt });
        } else if (attempt >= MAX_ATTEMPTS) {
          await supabase
            .from("orders")
            .update({
              webhook_status: "failed",
              webhook_attempts: attempt,
              last_webhook_at: new Date().toISOString(),
            })
            .eq("order_id", o.order_id);
          results.push({ order_id: o.order_id, status: "gave_up", attempt });
        } else {
          const delaySec = BACKOFF_SECONDS[attempt - 1] ?? 3600;
          const next = new Date(Date.now() + delaySec * 1000).toISOString();
          await supabase
            .from("orders")
            .update({
              webhook_attempts: attempt,
              next_webhook_at: next,
              last_webhook_at: new Date().toISOString(),
            })
            .eq("order_id", o.order_id);
          results.push({ order_id: o.order_id, status: "retry_scheduled", attempt, next });
        }
    }

    return Response.json({ dispatched: results.length, results });
}

export const Route = createFileRoute("/api/public/v1/internal/dispatch-webhooks")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
