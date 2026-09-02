import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolvePublicOrigin } from "@/lib/public-base";

const DEFAULT_PAYEE = "Merchant";

const CORS = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Methods": "POST, OPTIONS",
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

const BodySchema = z.object({
  amount: z.number().positive().max(1_000_000),
  merchant_order_id: z.string().trim().min(1).max(120),
  success_url: z.string().url().max(500),
  failure_url: z.string().url().max(500),
  webhook_url: z.string().url().max(500),
  domain: z.string().trim().min(1).max(253).optional(),
  customer: z
    .object({
      email: z.string().email().optional(),
      name: z.string().max(120).optional(),
    })
    .optional(),
});

function buildUpiUri(pa: string, pn: string, amount: number, orderId: string) {
  return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${amount.toFixed(2)}&cu=INR&tn=${orderId}`;
}

/** Server-rendered QR as an SVG data URL (no client QR library needed). */
async function buildQrDataUrl(text: string): Promise<string | null> {
  try {
    const QR = (await import("qrcode")).default;
    const svg = await QR.toString(text, { type: "svg", margin: 1, width: 320 });
    const b64 =
      typeof Buffer !== "undefined"
        ? Buffer.from(svg, "utf8").toString("base64")
        : btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${b64}`;
  } catch {
    return null;
  }
}

function gen10() {
  let s = "";
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export const Route = createFileRoute("/api/public/v1/orders")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          // Read the raw body once — the API key may also arrive inside it.
          const rawBody = await request.text();
          let bodyJson: any = {};
          try {
            bodyJson = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            return json({ error: "invalid_request", details: "body must be JSON" }, 400);
          }

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
             String(bodyJson.api_key ?? bodyJson.apiKey ?? bodyJson.key ?? "").trim() ||
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
             .select("id,active,owner_id")
             .eq("api_key_hash", apiKeyHash)
             .maybeSingle();
           if (!merchant) {
             // Fallback: match the plain key stored for the dashboard reveal.
             const { data: revealed } = await supabase
               .from("profiles_revealed")
               .select("user_id")
               .eq("api_key_plain", apiKey)
               .maybeSingle();
             if (revealed?.user_id) {
               const { data: byOwner } = await supabase
                 .from("merchants")
                 .select("id,active,owner_id")
                 .eq("owner_id", revealed.user_id)
                 .maybeSingle();
               merchant = byOwner ?? null;
             }
           }
           if (!merchant) return json({ error: "invalid_api_key" }, 401);
           if (!merchant.active) return json({ error: "merchant_disabled" }, 403);

           // Always read the merchant owner's latest UPI ID + payee at order time,
           // so updating the VPA in Settings takes effect immediately for every
           // new order — dashboard and merchant API integration alike.
           const { data: ownerProfile } = await supabase
             .from("profiles")
             .select("upi_id,payee_name")
             .eq("id", merchant.owner_id)




             .maybeSingle();
           const upiId = ownerProfile?.upi_id?.trim() || "";
           const payeeName = ownerProfile?.payee_name?.trim() || DEFAULT_PAYEE;

           if (!upiId) {
             return json(
               {
                 error: "upi_not_configured",
                 message:
                   "Merchant has not configured a UPI ID yet. Add your UPI ID in Settings before accepting payments.",
               },
               409,
             );
           }

           let parsed: z.infer<typeof BodySchema>;
           try {
             parsed = BodySchema.parse(bodyJson);
           } catch (e: any) {
             return json({ error: "invalid_request", details: e.errors ?? e.message }, 400);
           }

           // Idempotency: existing order with same merchant_order_id
           const { data: existing } = await supabase
             .from("orders")
             .select("*")
             .eq("merchant_id", merchant.id)
             .eq("merchant_order_id", parsed.merchant_order_id)
             .maybeSingle();
           if (existing) {
             const origin = resolvePublicOrigin(request);
             return json({
               order_id: existing.order_id,
               payable_amount: Number(existing.payable_amount),
               status: existing.status,
               expires_at: existing.expiry_at,
               payment_url: `${origin}/pay/${existing.order_id}`,
               idempotent_replay: true,
             });
           }

           const base = Math.round(parsed.amount * 100) / 100;
           const now = new Date();
           const nowIso = now.toISOString();
           const expiry = new Date(now.getTime() + 5 * 60 * 1000);

           // Free up stale pending slots.
           await supabase
             .from("orders")
             .update({ status: "expired" })
             .eq("status", "pending")
             .lt("expiry_at", nowIso);

           // Build candidate amount pool with overflow up to +2 rupees.
           const { data: takenRows, error: takenErr } = await supabase
              .from("orders")
              .select("payable_amount")
              .eq("status", "pending")
              .gte("payable_amount", base + 0.01)
              .lte("payable_amount", base + 2.99);
           if (takenErr) return json({ error: "db_error", message: takenErr.message }, 500);
           const taken = new Set(
              (takenRows ?? []).map((r) => Math.round(Number(r.payable_amount) * 100)),
           );

           function buildTier(offsetRupees: number): number[] {
             const out: number[] = [];
             for (let c = 1; c <= 99; c++) {
               const cents = Math.round((base + offsetRupees) * 100) + c;
               if (!taken.has(cents)) out.push(cents);
             }
             for (let i = out.length - 1; i > 0; i--) {
               const j = Math.floor(Math.random() * (i + 1));
               [out[i], out[j]] = [out[j], out[i]];
             }
             return out;
           }

           const candidates = [...buildTier(0), ...buildTier(1), ...buildTier(2)];
           if (candidates.length === 0) {
             return json({ error: "all_payment_slots_busy" }, 503);
           }

           for (const cents of candidates) {
             const payable = Math.round(cents) / 100;
             const orderId = gen10();
             const { data: inserted, error } = await supabase
               .from("orders")
               .insert({
                 order_id: orderId,
                 requested_amount: base,
                 payable_amount: payable,
                 status: "pending",
                 expiry_at: expiry.toISOString(),




                  merchant_id: merchant.id,
                  merchant_order_id: parsed.merchant_order_id,
                  webhook_url: parsed.webhook_url,
                  success_url: parsed.success_url,
                  failure_url: parsed.failure_url,
                  customer_email: parsed.customer?.email ?? null,
                  upi_pa: upiId,
                  upi_pn: payeeName,
                })
                .select()
                .single();
              if (!error && inserted) {
                const origin = resolvePublicOrigin(request);
                return json(
                  {
                    order_id: inserted.order_id,
                    payable_amount: Number(inserted.payable_amount),
                    status: inserted.status,
                    expires_at: inserted.expiry_at,
                    payment_url: `${origin}/pay/${inserted.order_id}`,
                  },
                  201,
                );
              }
              if (error && !/duplicate/i.test(error.message)) {
                return json({ error: "db_error", message: error.message }, 500);
              }
          }
          return json({ error: "all_payment_slots_busy" }, 503);
        } catch (e: any) {
          return json({ error: "internal_error", message: e.message }, 500);
        }
      },
    },
  },
});
