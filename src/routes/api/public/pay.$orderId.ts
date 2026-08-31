  import { createFileRoute } from "@tanstack/react-router";
  import { createClient } from "@supabase/supabase-js";

  const CORS = {




       "Access-Control-Allow-Origin": "*",
       "Access-Control-Allow-Methods": "GET, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type",
       "Access-Control-Max-Age": "86400",
  };

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // Public endpoint used by the hosted /pay/:orderId page. Returns ONLY the
  // fields the QR/payment page needs to render — no webhook URLs, no merchant
  // configuration, no payer email. Order ID is a 10-digit random number so
  // enumeration is not practical, but we still keep the surface minimal.
  export const Route = createFileRoute("/api/public/pay/$orderId")({
    server: {
      handlers: {
        OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
        GET: async ({ params }) => {
          try {
            const supabase = createClient(
               process.env.SUPABASE_URL!,
               process.env.SUPABASE_SERVICE_ROLE_KEY!,
               { auth: { persistSession: false } },
            );
            const { data, error } = await supabase
               .from("orders")
               .select(
                 "order_id,requested_amount,payable_amount,status,created_at,expiry_at,paid_at,success_url,failure_url,upi_pa,upi_pn",
               )
               .eq("order_id", params.orderId)
               .maybeSingle();
            if (error) return json({ error: "db_error" }, 500);
            if (!data) return json({ error: "not_found" }, 404);
            return json(data);
          } catch (e: any) {
            return json({ error: "internal_error", message: e.message }, 500);
          }
        },
      },
    },
  });
