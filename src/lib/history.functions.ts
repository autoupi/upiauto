import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!merchant) return { merchantId: null, orders: [] };
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("order_id, requested_amount, payable_amount, status, created_at, paid_at, expiry_at, payer_email, payer_name")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { merchantId: merchant.id as string, orders: data ?? [] };
  });
