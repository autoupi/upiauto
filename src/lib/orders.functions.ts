import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_PAYEE = "Merchant";

function gen10DigitId() {
  let s = "";
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amount: number }) =>
    z.object({ amount: z.number().positive().max(1000000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

     // Look up this user's merchant + profile (for UPI ID)
     const [{ data: merchant }, { data: profile }] = await Promise.all([
       supabaseAdmin.from("merchants").select("id").eq("owner_id", context.userId).maybeSingle(),
       supabaseAdmin.from("profiles").select("upi_id,payee_name").eq("id", context.userId).maybeSingle(),
     ]);

     const upiId = profile?.upi_id?.trim() || "";
     const payeeName = profile?.payee_name?.trim() || DEFAULT_PAYEE;

     if (!upiId) {
       throw new Error("Please add your UPI ID in Settings before generating a payment QR.");
     }

     const base = Math.round(data.amount * 100) / 100;
     const nowIso = new Date().toISOString();
     const expiry = new Date(Date.now() + 5 * 60 * 1000);

     // Proactively expire any stale pending rows so their amount slots free up.
     await supabaseAdmin
       .from("orders")
       .update({ status: "expired" })
       .eq("status", "pending")
       .lt("expiry_at", nowIso);

     // Build a candidate amount pool: base+0.01..+0.99, then +1.01..+1.99, then +2.01..+2.99.
     // Max overflow capped at +2 rupees (user rule). Paid / expired rows do NOT block — the
     // DB partial unique index is on pending only, and email matching also requires status='pending'
     // inside the order's [created_at, expiry_at] window, so collisions are impossible.
     const { data: takenRows, error: takenErr } = await supabaseAdmin
       .from("orders")
       .select("payable_amount")
       .eq("status", "pending")
       .gte("payable_amount", base + 0.01)
       .lte("payable_amount", base + 2.99);




     if (takenErr) throw new Error(takenErr.message);
     const taken = new Set(
       (takenRows ?? []).map((r) => Math.round(Number(r.payable_amount) * 100)),
     );

     function buildTier(offsetRupees: number): number[] {
       const out: number[] = [];
       for (let c = 1; c <= 99; c++) {
         const cents = Math.round((base + offsetRupees) * 100) + c;
         if (!taken.has(cents)) out.push(cents);
       }
       // shuffle
       for (let i = out.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [out[i], out[j]] = [out[j], out[i]];
       }
       return out;
     }

     const candidatesInOrder = [...buildTier(0), ...buildTier(1), ...buildTier(2)];
     if (candidatesInOrder.length === 0) {
       throw new Error("All payment slots are currently busy. Please try again in a few minutes.");
     }

     for (const cents of candidatesInOrder) {
       const payable = Math.round(cents) / 100;
       const orderId = gen10DigitId();

       const { data: inserted, error } = await supabaseAdmin
         .from("orders")
         .insert({
           order_id: orderId,
           requested_amount: base,
           payable_amount: payable,
           status: "pending",
           expiry_at: expiry.toISOString(),
           merchant_id: merchant?.id ?? null,
           upi_pa: upiId,
           upi_pn: payeeName,
         })
         .select()
         .single();

       if (!error && inserted) {
         const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${payable.toFixed(2)}&cu=INR&tn=${orderId}`;return { order: inserted, upiUrl }; } // Duplicate => another concurrent request grabbed this slot; try next candidate. if (error && !error.message.toLowerCase().includes("duplicate")) { throw new Error(error.message);}}throw new Error("All payment slots are currently busy. Please try again in a few minutes."); });
