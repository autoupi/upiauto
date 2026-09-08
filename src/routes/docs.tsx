import { createFileRoute } from "@tanstack/react-router";
import { PUBLIC_BASE_URL } from "@/lib/public-base";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "AutoUPI | Integration Documentation" },
      {
        name: "description",
        content:
          "Accept UPI payments on your website with AutoUPI. Server-to-server API, embedded QR widget, webhook signatures, and payment verification.",
      },
    ],
  }),
  component: DocsPage,
});

const BASE =
  PUBLIC_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "https://www.autoupi.shop");

const sections = [
  { id: "introduction", label: "Introduction" },
  { id: "quickstart", label: "Quickstart" },
  { id: "authentication", label: "Authentication" },
  { id: "create-order", label: "Create an Order" },
  { id: "hosted-payment", label: "Hosted Payment Page" },
  { id: "embedded-qr", label: "Embedded QR Widget" },
  { id: "webhooks", label: "Webhooks" },
  { id: "verify-payment", label: "Verify a Payment" },
  { id: "api-reference", label: "API Reference" },
  { id: "best-practices", label: "Best Practices" },
];

function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">On this page</p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block px-3 py-2 text-sm text-gray-600 hover:text-[#0d4a3a] hover:bg-gray-50 rounded-md transition"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <article className="prose prose-slate max-w-none">
            <div className="border-b border-gray-200 pb-6 mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b2a] mb-3">AutoUPI Integration Guide</h1>
              <p className="text-lg text-gray-600 m-0">
                Accept UPI payments on any website or mobile app. Create orders, display QR codes, receive webhooks, and verify payments — all through a simple HTTP API.
              </p>
            </div>

            <Section id="introduction" title="Introduction">
              <p>
                AutoUPI is a payment gateway built for UPI. You create an order from your server, we generate a unique QR code and UPI deep link, and notify your server via a signed webhook when the payment is completed.
              </p>
              <p>
                You can either redirect the customer to a hosted payment page or embed the QR widget directly on your site so the customer never leaves your checkout.
              </p>
              <p>
                This guide covers everything you need to integrate: authentication, order creation, the embedded widget, webhook handling, and payment verification.
              </p>
            </Section>

            <Section id="quickstart" title="Quickstart">
              <ol>
                <li>
                  <strong>Get your credentials.</strong> Sign in to the dashboard and go to{" "}
                  <a href="/api-keys" className="text-[#0d4a3a] font-medium">API Keys</a>. Copy your API key and webhook secret.
                </li>
                <li>
                  <strong>Create an order.</strong> Call <code>POST /api/public/v1/orders</code> from your server.
                </li>
                <li>
                  <strong>Show the QR.</strong> Either redirect to <code>payment_url</code> or embed the widget using the returned <code>upi_uri</code> / <code>qr_base64</code>.
                </li>
                <li>
                  <strong>Credit on webhook.</strong> Listen for <code>payment.success</code> events and credit the customer only after verifying the HMAC signature.
                </li>
              </ol>

              <div className="not-prose rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
                <strong>Trust rule:</strong> The browser redirect to your success page is only UX. Always credit the wallet or fulfill the order after your server receives and verifies the signed webhook.
              </div>
            </Section>

            <Section id="authentication" title="Authentication">
              <p>
                All API requests must include your API key in the <code>Authorization</code> header. Keep your API key and webhook secret server-side only — never expose them in browser code or mobile app bundles.
              </p>

              <CodeBlock title="Request header" lang="http">
                {`Authorization: Bearer <YOUR_API_KEY>`}
              </CodeBlock>

              <p>
                If your API key is compromised, regenerate it from the dashboard. The old key stops working immediately.
              </p>
            </Section>

            <Section id="create-order" title="Create an Order">
              <p>
                Create an order from your server. The amount is the value you want to collect. We return a payable amount that uniquely identifies this order, which helps us match the UPI transaction to your customer.
              </p>

              <CodeBlock title="Request" lang="bash">
                {`curl -X POST ${BASE}/api/public/v1/orders \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 100,
    "merchant_order_id": "order_12345",
    "success_url": "https://your-site.com/payment/success",
    "failure_url": "https://your-site.com/payment/failed",
    "webhook_url": "https://your-site.com/api/webhooks/autoupi",
    "customer": { "email": "customer@example.com" }
  }'`}
              </CodeBlock>

              <CodeBlock title="Response (201 Created)" lang="json">
                {`{
  "order_id": "PANME-1234567890",
  "payable_amount": 100.07,
  "status": "pending",
  "expires_at": "2026-09-08T17:30:00.000Z",
  "payment_url": "${BASE}/pay/PANME-1234567890",
  "upi_uri": "upi://pay?pa=...&am=100.07&cu=INR&tn=PANME-1234567890",
  "qr_base64": "data:image/svg+xml;base64,..."
}`}
              </CodeBlock>

              <h3>Request parameters</h3>
              <ParamTable
                rows={[
                  ["amount", "number", "Required. Amount to collect (INR)."],
                  ["merchant_order_id", "string", "Required. Your unique order identifier. Used for idempotency and webhook matching."],
                  ["success_url", "string", "Required. URL to redirect the customer after a successful payment."],
                  ["failure_url", "string", "Required. URL to redirect the customer after a failed or expired payment."],
                  ["webhook_url", "string", "Required. Endpoint on your server that receives payment events."],
                  ["customer", "object", "Optional. { email, phone, name } for reference."],
                ]}
              />

              <div className="not-prose rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800 mt-4">
                <strong>Idempotent:</strong> Calling again with the same <code>merchant_order_id</code> returns the existing order. Safe to retry on network errors.
              </div>
            </Section>

            <Section id="hosted-payment" title="Hosted Payment Page">
              <p>
                The simplest integration: redirect the customer to <code>payment_url</code>. They scan the QR, pay with any UPI app, and are redirected back to your <code>success_url</code> or <code>failure_url</code>.
              </p>

              <CodeBlock title="Redirect example" lang="javascript">
                {`// After creating the order on your server
window.location.href = order.payment_url;`}
              </CodeBlock>

              <p>
                Do not trust query parameters on the return URL. Always verify the payment status by calling the server-side verification endpoint.
              </p>
            </Section>

            <Section id="embedded-qr" title="Embedded QR Widget">
              <p>
                Keep the customer on your site by embedding the QR widget. Add the script and a container element anywhere on your checkout page.
              </p>

              <CodeBlock title="HTML" lang="html">
                {`<div id="panme-pay"></div>
<script src="${BASE}/embed/panme-pay.js"></script>
<script>
  PanMePay.mount("#panme-pay", {
    // Recommended: proxy through your own server so your API key never reaches the browser.
    createOrderUrl: "/api/create-order",
    statusUrl: "/api/order-status/",
    onSuccess: function (order) {
      // Refresh UI only. Wallet credit must still happen via webhook.
      location.reload();
    }
  });
</script>`}
              </CodeBlock>

              <h3>Widget options</h3>
              <ParamTable
                rows={[
                  ["apiKey", "string", "Your API key. Use only for quick testing; production should proxy through your server."],
                  ["createOrderUrl", "string", "Your server endpoint. POST { amount } and return the gateway order JSON."],
                  ["statusUrl", "string", "Your server endpoint. GET <order_id> and return the gateway status JSON."],
                  ["onSuccess", "function", "Called when the order status becomes paid. Use for UI updates only."],
                ]}
              />

              <div className="not-prose rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 mt-4">
                <strong>Important:</strong> The widget's <code>onSuccess</code> callback is for UI feedback only. Always credit the customer after your server verifies the signed webhook.
              </div>
            </Section>

            <Section id="webhooks" title="Webhooks">
              <p>
                Webhooks are the source of truth for payment status. We POST to your <code>webhook_url</code> with a signed payload. Verify the signature before processing.
              </p>

              <h3>Webhook headers</h3>
              <ParamTable
                rows={[
                  ["X-Signature", "string", "HMAC-SHA256 signature in the format t=<unix>,v1=<hex>."],
                  ["X-Webhook-Id", "string", "Unique ID for this delivery attempt. Use for idempotency logging."],
                  ["X-Event", "string", "payment.success, payment.expired, or payment.failed."],
                ]}
              />

              <h3>Webhook body</h3>
              <CodeBlock title="payment.success" lang="json">
                {`{
  "event": "payment.success",
  "order_id": "PANME-1234567890",
  "merchant_order_id": "order_12345",
  "amount": 100,
  "payable_amount": 100.07,
  "paid_at": "2026-09-08T17:26:01.000Z",
  "payer_email": "no-reply@paytm.com",
  "attempt": 1
}`}
              </CodeBlock>

              <h3>Signature verification</h3>
              <p>
                The signature is computed over <code>&lt;t&gt;.&lt;raw_body&gt;</code> using your webhook secret. Read the raw request body before parsing JSON.
              </p>

              <CodeBlock title="Node.js / Next.js" lang="javascript">
                {`import { createHmac, timingSafeEqual } from "crypto";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-signature") ?? "";
  const [tPart = "", vPart = ""] = sig.split(",");
  const t = tPart.split("=")[1];
  const v1 = vPart.split("=")[1];
  if (!t || !v1) return new Response("bad signature", { status: 401 });

  // Reject payloads older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) {
    return new Response("stale", { status: 400 });
  }

  const expected = createHmac("sha256", process.env.AUTOUPI_WEBHOOK_SECRET)
    .update(\`\${t}.\${raw}\`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(raw);

  // Idempotent credit logic
  if (event.event === "payment.success") {
    // credit wallet / fulfill order
  }

  return new Response("ok", { status: 200 });
}`}
              </CodeBlock>

              <p>
                Always return <code>200 OK</code> for duplicate or already-processed webhooks. We retry failed deliveries with exponential backoff for up to 8 attempts.
              </p>
            </Section>

            <Section id="verify-payment" title="Verify a Payment">
              <p>
                After the customer returns to your site, verify the order status from your server before showing a success message.
              </p>

              <CodeBlock title="Request" lang="bash">
                {`curl ${BASE}/api/public/v1/orders/PANME-1234567890 \\
  -H "Authorization: Bearer <YOUR_API_KEY>"`}
              </CodeBlock>

              <CodeBlock title="Response" lang="json">
                {`{
  "order_id": "PANME-1234567890",
  "status": "paid",
  "amount": 100,
  "payable_amount": 100.07,
  "paid_at": "2026-09-08T17:26:01.000Z"
}`}
              </CodeBlock>

              <p>
                If your database still shows the order as pending, show a "Processing" message and ask the customer to wait a few seconds. Webhooks usually arrive before the customer returns.
              </p>
            </Section>

            <Section id="api-reference" title="API Reference">
              <h3>POST /api/public/v1/orders</h3>
              <p>Create a new payment order. Returns order details including <code>payment_url</code>, <code>upi_uri</code>, and <code>qr_base64</code>.</p>

              <h3>GET /api/public/v1/orders/:id</h3>
              <p>Retrieve the current status of an order.</p>

              <h3>Status values</h3>
              <div className="not-prose my-4 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Status</th>
                      <th className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["pending", "Order created, waiting for payment."],
                      ["paid", "Payment completed and verified."],
                      ["expired", "Payment window closed without a match."],
                      ["failed", "Payment could not be completed."],
                      ["manual_review", "Multiple pending orders shared the same amount; automatic matching was skipped."],
                    ].map(([status, desc], i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 font-mono text-[#0d4a3a] font-medium">{status}</td>
                        <td className="px-4 py-3 text-gray-700">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="best-practices" title="Best Practices">
              <ul>
                <li>
                  <strong>Store credentials server-side.</strong> Never put your API key or webhook secret in frontend code.
                </li>
                <li>
                  <strong>Verify webhooks.</strong> Always check the HMAC signature before crediting a customer.
                </li>
                <li>
                  <strong>Be idempotent.</strong> Check the current order status before updating. Return 200 for duplicates.
                </li>
                <li>
                  <strong>Lock rows.</strong> Credit wallets inside a database transaction with a row lock on <code>merchant_order_id</code>.
                </li>
                <li>
                  <strong>Verify on return.</strong> Do not trust <code>?status=paid</code> in the return URL. Call the verification endpoint.
                </li>
                <li>
                  <strong>Reconcile daily.</strong> Query pending orders older than 10 minutes and sync their status with the gateway.
                </li>
              </ul>

              <div className="not-prose rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 mt-4">
                <strong>Data retention:</strong> Transactional data such as orders, payment history, and webhook logs are purged daily at midnight IST. Keep order and payment records in your own database when the webhook arrives. Your account, API keys, and settings are never deleted.
              </div>
            </Section>
          </article>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 mb-12">
      <h2 className="text-2xl font-bold text-[#0d1b2a] mb-4 pb-2 border-b border-gray-100">{title}</h2>
      <div className="text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function CodeBlock({ title, lang, children }: { title?: string; lang: string; children: string }) {
  return (
    <div className="not-prose my-5 rounded-xl border border-gray-200 overflow-hidden bg-[#0d1b2a]">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#162032] border-b border-gray-700">
          <span className="text-xs font-medium text-gray-300">{title}</span>
          <span className="text-xs text-gray-500 uppercase">{lang}</span>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-gray-100 font-mono whitespace-pre">{children}</code>
      </pre>
    </div>
  );
}

function ParamTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="not-prose my-4 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Field</th>
            <th className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Type</th>
            <th className="px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, type, desc], i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-3 font-mono text-[#0d4a3a] font-medium">{field}</td>
              <td className="px-4 py-3 text-gray-500">{type}</td>
              <td className="px-4 py-3 text-gray-700">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
