import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("email,display_name,upi_id,payee_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { email: null, display_name: null, upi_id: null, payee_name: null };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { display_name?: string; upi_id?: string; payee_name?: string }) =>
    z.object({
      display_name: z.string().trim().max(80).optional(),
      upi_id: z.string().trim().max(80).optional(),
      payee_name: z.string().trim().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });




export const getMyApiKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error: e1 } = await supabaseAdmin
      .from("merchants")
      .select("api_key_prefix,webhook_secret")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!m) throw new Error("No merchant found for user");

     const { data: rev } = await supabaseAdmin
       .from("profiles_revealed")
       .select("api_key_plain")
       .eq("user_id", context.userId)
       .maybeSingle();

    return {
      prefix: m.api_key_prefix,
      webhookSecret: m.webhook_secret,
      apiKeyPlain: rev?.api_key_plain ?? null,
    };
  });



export const acknowledgeRevealedKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles_revealed")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- API key rotation -------------------------------------------------------
export const rotateMyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateApiKey, hashApiKey } = await import("@/lib/gateway-crypto.server");

     const { data: m, error: mErr } = await supabaseAdmin
       .from("merchants")
       .select("id")
       .eq("owner_id", context.userId)
       .maybeSingle();
     if (mErr) throw new Error(mErr.message);
     if (!m) throw new Error("No merchant found for user");

     const newKey = generateApiKey();
     const newHash = hashApiKey(newKey);
     const newPrefix = newKey.slice(0, 12);

     const { error: uErr } = await supabaseAdmin
       .from("merchants")
       .update({ api_key_hash: newHash, api_key_prefix: newPrefix })
       .eq("id", m.id);
     if (uErr) throw new Error(uErr.message);

     const { error: rErr } = await supabaseAdmin
       .from("profiles_revealed")
       .upsert({ user_id: context.userId, api_key_plain: newKey }, { onConflict: "user_id" });
     if (rErr) throw new Error(rErr.message);

    return { prefix: newPrefix, apiKeyPlain: newKey };
  });

// --- Allowed domains --------------------------------------------------------
function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) throw new Error("Domain required");
  // strip scheme + path
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  s = s.replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) throw new Error("Invalid domain");
  return s;
}

export const listMyDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("merchant_domains")
      .select("id,domain,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addMyDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])




  .inputValidator((d: { domain: string }) => z.object({ domain: z.string().min(3).max(253) }).parse(d))
  .handler(async ({ data, context }) => {
    const domain = normalizeDomain(data.domain);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("merchants").select("id").eq("owner_id", context.userId).maybeSingle();
    if (!m) throw new Error("No merchant");
    const { error } = await supabaseAdmin
      .from("merchant_domains")
      .insert({ merchant_id: m.id, domain });
    if (error) {
      if (/duplicate/i.test(error.message)) throw new Error("Domain already added");
      throw new Error(error.message);
    }
    return { ok: true, domain };
  });

export const deleteMyDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("merchant_domains").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
