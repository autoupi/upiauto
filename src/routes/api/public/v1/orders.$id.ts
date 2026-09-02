import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const CORS = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Methods": "GET, OPTIONS",
   "Access-Control-Allow-Headers":
     "Content-Type, Authorization, X-Api-Key, Api-Key, X-Authorization, Accept, Origin",
   "Access-Control-Max-Age": "86400",
};
function json(body: unknown, status = 200) {
   return new Response(JSON.stringify(body), {
     status,
     headers: { "Content-Type": "application/json", ...CORS },
   });
}

// Embedded/merchant status polling also has to drive inbox scanning, otherwise
// payments are only detected when the hosted /pay page is open. Throttled so a
// 3s widget poll never hammers IMAP.
let lastScanAt = 0;
async function triggerInboxScan(request: Request) {
  const now = Date.now();
  if (now - lastScanAt < 10_000) return;
  lastScanAt = now;
  try {
    const origin = new URL(request.url).origin;
    await fetch(`${origin}/api/public/payments/poll`, { method: "POST" });
  } catch {
    /* detection also runs from cron; ignore transient failures */
  }
}


export const Route = createFileRoute("/api/public/v1/orders/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        try {
          const url = new URL(request.url);
          const headerKey = (name: string) => (request.headers.get(name) ?? "").trim();
          const authHeader = headerKey("authorization") || headerKey("x-authorization");
          const bearer = /^bearer\s+/i.test(authHeader)
            ? authHeader.replace(/^bearer\s+/i, "").trim()
            : authHeader;
          const apiKey = (
            bearer ||
            headerKey("x-api-key") ||
            headerKey("api-key") ||
            headerKey("x-gateway-key") ||
            (url.searchParams.get("api_key") ?? "").trim()
          ).replace(/^["']|["']$/g, "");
          if (!apiKey) return json({ error: "missing_api_key" }, 401);

           const { createHash } = await import("crypto");
           const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

           const supabase = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              { auth: { persistSession: false } },
           );

           let { data: merchant } = await supabase
             .from("merchants")
             .select("id")
             .eq("api_key_hash", apiKeyHash)
             .maybeSingle();




           if (!merchant) {
             const { data: revealed } = await supabase
               .from("profiles_revealed")
               .select("user_id")
               .eq("api_key_plain", apiKey)
               .maybeSingle();
             if (revealed?.user_id) {
               const { data: byOwner } = await supabase
                 .from("merchants")
                 .select("id")
                 .eq("owner_id", revealed.user_id)
                 .maybeSingle();
               merchant = byOwner ?? null;
             }
           }
           if (!merchant) return json({ error: "invalid_api_key" }, 401);

           const { data: order } = await supabase
             .from("orders")
             .select(
               "order_id,merchant_order_id,status,requested_amount,payable_amount,created_at,expiry_at,paid_at,failed_at,payer_email",
             )
             .eq("order_id", params.id)
             .eq("merchant_id", merchant.id)
             .maybeSingle();
           if (!order) return json({ error: "order_not_found" }, 404);

          return json({
            order_id: order.order_id,
            merchant_order_id: order.merchant_order_id,
            status: order.status,
            amount: Number(order.requested_amount),
            payable_amount: Number(order.payable_amount),
            created_at: order.created_at,
            expires_at: order.expiry_at,
            paid_at: order.paid_at,
            failed_at: order.failed_at,
            payer_email: order.payer_email,
          });
        } catch (e: any) {
          return json({ error: "internal_error", message: e.message }, 500);
        }
      },
    },
  },
});
