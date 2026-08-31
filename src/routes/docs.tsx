import { createFileRoute } from "@tanstack/react-router";
import { PUBLIC_BASE_URL } from "@/lib/public-base";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "AutoUPI | Docs" },
      {
        name: "description",
        content:
          "How to integrate AutoUPI payment gateway into your website with webhooks, signature verification, and wallet credit flow.",
      },
    ],
  }),
  component: DocsPage,
});

const BASE =
  PUBLIC_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app");

function DocsPage() {
  return (
    <main className="min-h-screen bg-background">
      <article className="max-w-3xl mx-auto px-6 py-10 prose prose-slate dark:prose-invert">
        <h1>AutoUPI Gateway — Integration Guide</h1>
        <p className="lead">
          Accept UPI payments on your website. We generate a QR, detect payment from Paytm email
          notifications in real-time, and send a signed webhook to your server so you can credit
          the user's wallet — securely and reliably.
        </p>

        <h2>1. Flow overview</h2>
        <pre>{`[Your site server]            [AutoUPI Gateway]            [User Browser]
1. POST /api/public/v1/orders ─► create order
                              ◄─ { payment_url, order_id }
2. redirect user ───────────────────────────────────────► payment_url
                                  QR + auto-detect via email
3. POST webhook (HMAC) ──► [Your /api/webhooks/autoupi]
                              verify signature → credit wallet (idempotent)




                          ◄── 200 OK
4. redirect user back ───────────────────────────────────► success_url / failure_url`}</pre>
        <p>
          <b>Trust rule:</b> The browser redirect to your success page is just UX. Wallet credit
          must happen only when your server receives the signed webhook and verifies its HMAC.
          Never trust query params like <code>?status=paid</code>.
        </p>

        <h2>2. One-time setup</h2>
        <ol>
          <li>
             Sign in and open <a href="/api-keys">API Keys</a>. Copy your <b>API Key</b> (shown once)
             and <b>Webhook Secret</b>. If your API key ever leaks, click <b>Regenerate</b> on the
             same page — the old key stops working instantly.
          </li>
          <li>
             Add the credentials as <b>server-side</b> secrets on your site (never in browser code):
             <pre>{`AUTOUPI_API_KEY=lk_live_xxxxxxxxxxxxxxxxxxxxxxxx
AUTOUPI_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx`}</pre>
          </li>
        </ol>

         <h2>2a. Security checklist</h2>
         <ul>
           <li><b>Regenerate API key:</b> API Keys page → Regenerate. Use immediately if leaked — the old key dies instantly.</li>
           <li><b>Webhook HMAC:</b> Every webhook is signed — always verify before crediting users.</li>
         </ul>



        <h2>3. Create an order (server → server)</h2>
        <pre>{`POST ${BASE}/api/public/v1/orders
Authorization: Bearer $AUTOUPI_API_KEY
Content-Type: application/json

{
  "amount": 100,
  "merchant_order_id": "wallet_topup_<user_id>_<uuid>",
  "success_url": "https://your-site.com/wallet/topup/success",
  "failure_url": "https://your-site.com/wallet/topup/failed",
  "webhook_url": "https://your-site.com/api/webhooks/autoupi",
  "customer": { "email": "user@example.com" }
}`}</pre>
        <p>Response (201):</p>
        <pre>{`{
  "order_id": "1234567890",
  "payable_amount": 100.07,
  "status": "pending",
  "expires_at": "2026-06-16T17:30:00.000Z",
  "payment_url": "${BASE}/pay/1234567890"
}`}</pre>
        <p>
          <b>Idempotent:</b> calling again with the same <code>merchant_order_id</code> returns the
          existing order (safe to retry on network errors).
        </p>

        <h3>Node.js / Next.js example</h3>
        <pre>{`// app/api/wallet/topup/route.ts (Next.js)
export async function POST(req: Request) {
  const { userId, amount } = await req.json();
  const merchantOrderId = \`topup_\${userId}_\${crypto.randomUUID()}\`;

    // 1) Record intent in YOUR DB first (status='pending')
    await db.walletTopups.insert({
      merchant_order_id: merchantOrderId,
      user_id: userId,
      amount,
      status: 'pending',
    });

  // 2) Create gateway order
  const r = await fetch('${BASE}/api/public/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.AUTOUPI_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      merchant_order_id: merchantOrderId,
      success_url: 'https://your-site.com/wallet/topup/success',
      failure_url: 'https://your-site.com/wallet/topup/failed',
      webhook_url: 'https://your-site.com/api/webhooks/autoupi',
      customer: { email: user.email },
    }),
  });
  if (!r.ok) return new Response('payment_error', { status: 502 });
  const data = await r.json();
  return Response.json({ payment_url: data.payment_url });
}`}</pre>
        <p>Then your browser code just navigates to <code>data.payment_url</code>.</p>

         <h2>4. Webhook handler (the source of truth)</h2>
         <p>We POST to your <code>webhook_url</code> with these headers:</p>
         <ul>




          <li><code>X-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> — HMAC-SHA256 of <code>"&lt;t&gt;.&lt;raw_body&gt;"</code> using your webhook
secret.</li>
          <li><code>X-Webhook-Id</code> — unique per attempt (use for idempotency logging).</li>
          <li><code>X-Event</code> — one of <code>payment.success</code>, <code>payment.expired</code>, <code>payment.failed</code>.</li>
        </ul>
        <p>Body:</p>
        <pre>{`{
  "event": "payment.success",
  "order_id": "1234567890",
  "merchant_order_id": "topup_42_abc",
  "amount": 100,
  "payable_amount": 100.07,
  "paid_at": "2026-06-16T17:26:01.000Z",
  "failed_at": null,
  "payer_email": "no-reply@paytm.com",
  "attempt": 1
}`}</pre>

        <h3>Node.js handler — full reference</h3>
        <pre>{`// app/api/webhooks/autoupi/route.ts
import { createHmac, timingSafeEqual } from 'crypto';

export async function POST(req: Request) {
  const raw = await req.text(); // IMPORTANT: read RAW body, do not JSON.parse first
  const sig = req.headers.get('x-signature') ?? '';
  const [tPart = '', vPart = ''] = sig.split(',');
  const t = tPart.split('=')[1];
  const v1 = vPart.split('=')[1];
  if (!t || !v1) return new Response('bad sig', { status: 401 });

  // Replay protection: reject if older than 5 minutes
  if (Math.abs(Date.now()/1000 - Number(t)) > 300) {
    return new Response('stale', { status: 400 });
  }

  const expected = createHmac('sha256', process.env.AUTOUPI_WEBHOOK_SECRET!)
    .update(\`\${t}.\${raw}\`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response('invalid signature', { status: 401 });
  }

  const evt = JSON.parse(raw);

  // Idempotent credit — wrap in a transaction with row lock
  await db.transaction(async (tx) => {
    const topup = await tx.walletTopups
      .where({ merchant_order_id: evt.merchant_order_id })
      .forUpdate()
      .first();
    if (!topup) return;                          // unknown order
    if (topup.status === 'paid') return;         // duplicate webhook — already credited
    if (topup.status === 'failed' || topup.status === 'expired') return;

    if (evt.event === 'payment.success') {
      await tx.walletTopups.update(topup.id, { status: 'paid', paid_at: evt.paid_at });
      await tx.wallets.increment(topup.user_id, evt.amount); // CREDIT WALLET HERE
    } else if (evt.event === 'payment.expired') {
      await tx.walletTopups.update(topup.id, { status: 'expired' });
    } else if (evt.event === 'payment.failed') {
      await tx.walletTopups.update(topup.id, { status: 'failed' });
    }
  });

  return new Response('ok', { status: 200 });
}`}</pre>

        <h3>Python (FastAPI) handler</h3>
        <pre>{`import hmac, hashlib, time, os
from fastapi import Request, HTTPException

@app.post("/api/webhooks/autoupi")
async def autoupi(req: Request):
    raw = await req.body()
    sig = req.headers.get("x-signature","")
    parts = dict(p.split("=",1) for p in sig.split(","))
    t, v1 = parts.get("t"), parts.get("v1")
    if not t or not v1: raise HTTPException(401)
    if abs(time.time() - int(t)) > 300: raise HTTPException(400, "stale")

     expected = hmac.new(os.environ["AUTOUPI_WEBHOOK_SECRET"].encode(),
                         f"{t}.{raw.decode()}".encode(), hashlib.sha256).hexdigest()
     if not hmac.compare_digest(expected, v1): raise HTTPException(401)

     evt = await req.json()
     # ... idempotent credit logic ...
     return {"ok": True}`}</pre>

         <h2>5. Success / Failure pages on your site</h2>
         <p>
           The user is redirected to <code>success_url?order_id=...&amp;status=paid</code> after
           payment. <b>Don't trust the query string</b> — call the gateway to verify:
         </p>




        <pre>{`GET ${BASE}/api/public/v1/orders/<order_id>
Authorization: Bearer $AUTOUPI_API_KEY

→ { "order_id": "...", "status": "paid", "amount": 100, "paid_at": "...", ... }`}</pre>
        <p>
          On your success page render based on the verified status AND on your own wallet DB. If
          your DB still says "pending" (webhook not yet processed), show "Processing — refresh in a
          few seconds". Realtime users typically arrive after the webhook has already settled.
        </p>

         <h2>6. Reconciliation (recommended cron)</h2>
         <p>
           Once a day, list your <code>pending</code> topups older than 10 minutes and call{" "}
           <code>GET /orders/:id</code> to sync. This catches any edge case where your webhook
           server was offline during all retry attempts (~9 hours).
         </p>

         <h2>7. Reliability &amp; error handling</h2>
         <ul>
           <li>
              <b>User closes browser mid-payment</b> — the webhook still fires; wallet is credited.
           </li>
           <li>
              <b>User loses internet</b> — gateway email polling continues; webhook still fires when
              payment lands.
           </li>
           <li>
              <b>Your webhook endpoint is down</b> — we retry with exponential backoff (10s, 30s, 2m,
              10m, 30m, 1h, 3h, 6h) — up to 8 attempts over ~9 hours. Every attempt is logged.
           </li>
           <li>
              <b>Duplicate webhook</b> — your handler must be idempotent (check current status
              before crediting). 200 OK is the correct response for duplicates.
           </li>
           <li>
              <b>Replay attack</b> — rejected by the 5-minute timestamp window in <code>X-Signature</code>.
           </li>
           <li>
              <b>Tampered payload</b> — rejected by HMAC verification.
           </li>
           <li>
              <b>User edits redirect URL</b> — your success page must verify with{" "}
              <code>GET /orders/:id</code>; the URL alone proves nothing.
           </li>
           <li>
              <b>Inspect/console bypass on QR page</b> — impossible. The QR page can't credit
              anything; only your server's webhook handler can, and it requires a valid signature.
           </li>
         </ul>

         <h2>8. Security checklist</h2>
         <ul>
           <li>API key &amp; webhook secret stored as server-side env vars only.</li>
           <li>Webhook handler reads <b>raw</b> body before JSON.parse (signature is over raw bytes).</li>
           <li>Use <code>timingSafeEqual</code>, never <code>===</code>, to compare signatures.</li>
           <li>Wallet credit inside a DB transaction with row lock on <code>merchant_order_id</code>.</li>
           <li>Always return 200 for already-processed webhooks (don't error → we'd retry forever).</li>
           <li>Rotate the webhook secret by creating a new merchant if exposed.</li>
         </ul>

         <h2>9. API reference</h2>
         <h3>POST /api/public/v1/orders</h3>
         <p>Auth: <code>Authorization: Bearer &lt;api_key&gt;</code>. See section 3.</p>
         <h3>GET /api/public/v1/orders/:id</h3>
         <p>Auth required. Returns current order status. Section 5.</p>

        <h2>10. Status values</h2>
        <ul>
          <li><code>pending</code> — order created, waiting for payment.</li>
          <li><code>paid</code> — payment detected &amp; matched.</li>
          <li><code>expired</code> — 5 minutes passed without matching payment.</li>
          <li><code>failed</code> — explicit failure (rare; reserved).</li>
          <li><code>manual_review</code> — multiple pending orders shared the same payable amount; we won't auto-credit (we'll never send
<code>payment.success</code> for this).</li>
        </ul>
      </article>
    </main>
  );
}
