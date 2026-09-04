import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { InboxMessage } from "@/lib/imap-reader.server";

const MONITOR_SENDERS = ["no-reply@paytm.com", "noreply@phonepe.com"];
// Amount patterns, tried in order. Real emails put the amount in the BODY with
// odd spacing, e.g. PhonePe: "Received₹ 1.51" / "Received ₹1.51 from X".
const AMOUNT_PATTERNS: RegExp[] = [
   /Rs\.?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s+paid/i,
   /Received\s*(?:₹|Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
   /(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*\.[0-9]{2})/i,
];
const NAME_PATTERNS: RegExp[] = [
   /Paid\s*by\s*:\s*([A-Za-z][A-Za-z .'\-]{1,60}?)(?=\s*(?:Txn|Store|Status|Hi|$))/i,
   /paid\s+by\s+([A-Za-z][A-Za-z .'\-]{1,60}?)(?=\s+(?:on|via|to|using|at|through|\-|–|—|$))/i,
   /from\s+([A-Za-z][A-Za-z .'\-]{1,60}?)(?=\s+(?:on|via|to|using|at|through|\-|–|—|$))/i,
   /by\s+([A-Za-z][A-Za-z .'\-]{1,60}?)(?=\s+(?:on|via|to|using|at|through|\-|–|—|$))/i,
];

function extractAmount(s: string): number | null {
  for (const re of AMOUNT_PATTERNS) {
    const m = s.match(re);
    if (m && m[1]) {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}
function extractName(s: string): string | null {
  for (const re of NAME_PATTERNS) {
    const m = s.match(re);
    if (m && m[1]) {
      const n = m[1].trim().replace(/\s+/g, " ");
      if (n.length >= 2 && n.length <= 60) return n;
    }
  }
  return null;
}
function senderMatches(from: string): boolean {
  const f = from.toLowerCase();
  return MONITOR_SENDERS.some((s) => f.includes(s));
}

export const Route = createFileRoute("/api/public/payments/poll")({
  server: { handlers: { POST: handler, GET: handler } },
});




async function handler({ request }: { request: Request }) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

    // Expire stale pending orders first.
    await supabase
      .from("orders")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expiry_at", new Date().toISOString());

    try {
      // One pass per connected merchant inbox (dashboard App Password), plus the
      // env-configured inbox when present. Matching logic is identical for each.
       const orderId = new URL(request.url).searchParams.get("order_id")?.trim();
       let ownerId: string | null = null;
       if (orderId) {
         const { data: order } = await supabase
           .from("orders")
           .select("merchants!inner(owner_id)")
           .eq("order_id", orderId)
           .maybeSingle();
         const merchant = Array.isArray(order?.merchants) ? order.merchants[0] : order?.merchants;
         ownerId = merchant?.owner_id ?? null;
         if (!ownerId) {
           return Response.json({ ok: false, error: "Order not found." }, { status: 404 });
         }
       }

       let accountsQuery = supabase
         .from("email_accounts")
         .select("user_id,email_address,app_password")
         .eq("status", "connected");
       if (ownerId) accountsQuery = accountsQuery.eq("user_id", ownerId);
       const { data: accounts } = await accountsQuery;

     const inboxes: Array<{ user_id: string | null; user?: string; pass?: string }> =
       (accounts ?? []).map((a: any) => ({ user_id: a.user_id, user: a.email_address, pass: a.app_password }));
     if (inboxes.length === 0 && process.env.GMAIL_IMAP_USER && process.env.GMAIL_APP_PASSWORD) {
       inboxes.push({ user_id: null });
     }
     if (inboxes.length === 0) {
       return Response.json({ ok: false, error: "No connected email account. Connect Gmail in Settings." }, { status: 400 });
     }

      let scanned = 0;
      let matched = 0;
      const results: any[] = [];
      for (const inbox of inboxes) {
        try {
          const r = await scanInbox(supabase, inbox);
          scanned += r.scanned;
          matched += r.matched;
          results.push(...r.results);
        } catch (e: any) {
          results.push({ inbox: inbox.user ?? "env", error: e.message });
        }
      }
      return Response.json({ ok: true, inboxes: inboxes.length, scanned, matched, results });
    } catch (e: any) {
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
}

async function scanInbox(
  supabase: any,
  inbox: { user_id: string | null; user?: string; pass?: string },
): Promise<{ scanned: number; matched: number; results: any[] }> {
  // Read the merchant's own inbox over IMAP with their App Password.
  const { fetchRecentMessages } = await import("@/lib/imap-reader.server");
  const messages: InboxMessage[] = await fetchRecentMessages({
    senders: MONITOR_SENDERS,
    withinMinutes: 10,
    maxResults: 15,
    ...(inbox.user ? { user: inbox.user } : {}),
    ...(inbox.pass ? { pass: inbox.pass } : {}),
  });
  if (messages.length === 0) return { scanned: 0, matched: 0, results: [] };

    // Scope candidate orders to this merchant when the inbox belongs to one.
    let merchantId: string | null = null;
    if (inbox.user_id) {
      const { data: m } = await supabase
        .from("merchants")
        .select("id")
        .eq("owner_id", inbox.user_id)
        .maybeSingle();
      merchantId = m?.id ?? null;
    }

    const ids = messages.map((m) => m.id);
    const { data: existing } = await supabase
      .from("processed_emails")
      .select("message_id")
      .in("message_id", ids);
    const seen = new Set((existing ?? []).map((r: any) => r.message_id));
    const fresh = messages.filter((m) => !seen.has(m.id));
    if (fresh.length === 0) return { scanned: 0, matched: 0, results: [] };

    let matched = 0;
    const results: any[] = [];

    const metaList = fresh.map((msg) => ({ id: msg.id, msg, error: null as any }));

    for (const item of metaList) {
      const { id, msg, error } = item;
      if (error) { results.push({ id, error: error.message }); continue; }




        const { error: claimErr } = await supabase
          .from("processed_emails")
          .insert({ message_id: id });
        if (claimErr) { results.push({ id, skipped: "already claimed" }); continue; }

        try {
          const subject = msg.subject ?? "";
          const from = msg.from ?? "";
          // Amount/payer can be in the subject OR the body — scan both.
          const text = `${subject} ${msg.body ?? ""}`.trim();

         if (!senderMatches(from)) { results.push({ id, skipped: "sender mismatch" }); continue; }

         const emailTimeMs = msg.internalDate ? Number(msg.internalDate) : Date.now();
         const emailTime = new Date(emailTimeMs).toISOString();
         const amount = extractAmount(text);
         if (amount === null) { results.push({ id, skipped: "no amount" }); continue; }
         const payerName = extractName(text);

         const { data: alreadyUsed } = await supabase
           .from("orders")
           .select("order_id")
           .eq("paid_email_id", id)
           .maybeSingle();
         if (alreadyUsed) { results.push({ id, skipped: "already attributed" }); continue; }

         let candQuery = supabase
           .from("orders")
           .select("*")
           .eq("status", "pending")
           .eq("payable_amount", amount)
           .lte("created_at", emailTime)
           .gte("expiry_at", emailTime);
         if (merchantId) candQuery = candQuery.eq("merchant_id", merchantId);
         const { data: candidates, error: candErr } = await candQuery;

         if (candErr) { results.push({ id, error: candErr.message }); continue; }
         if (!candidates || candidates.length === 0) {
           results.push({ id, skipped: "no matching pending order", amount });
           continue;
         }
         if (candidates.length > 1) {
           await supabase
             .from("orders")
             .update({ status: "manual_review" })
             .in("order_id", candidates.map((c: any) => c.order_id))
             .eq("status", "pending");
           results.push({ id, skipped: "multiple matches - manual review" });
           continue;
         }

         const order = candidates[0];
         const { data: updated, error: updErr } = await supabase
           .from("orders")
           .update({
             status: "paid",
             paid_at: emailTime,
             payer_email: from,
             payer_name: payerName,
             paid_email_id: id,
           })
           .eq("order_id", order.order_id)
           .eq("status", "pending")
           .is("paid_email_id", null)
           .select()
           .maybeSingle();

         if (updErr) { results.push({ id, skipped: "unique conflict" }); continue; }
         if (!updated) { results.push({ id, skipped: "order no longer pending" }); continue; }

         await supabase
           .from("processed_emails")
           .update({ order_id: order.order_id })
           .eq("message_id", id);

          matched++;
          results.push({ id, matched: order.order_id, amount });
        } catch (e: any) {
          results.push({ id, error: e.message });
        }
    }

    return { scanned: fresh.length, matched, results };
}
