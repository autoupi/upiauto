import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EmailAccountStatus {
  email_address: string | null;
  status: "connected" | "disconnected";
  last_error: string | null;
  last_checked_at: string | null;
  connected_at: string | null;
}

const empty: EmailAccountStatus = {
   email_address: null,
   status: "disconnected",
   last_error: null,
   last_checked_at: null,
   connected_at: null,
};

/** Current stored state (never returns the App Password). */
export const getMyEmailAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailAccountStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("email_accounts")
      .select("email_address,status,last_error,last_checked_at,connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return (data as EmailAccountStatus | null) ?? empty;
  });

/** Verify the App Password over IMAP, then save it and mark connected. */




export const connectMyEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; app_password: string }) =>
    z.object({
      email: z.string().trim().email(),
      app_password: z.string().min(8).max(128),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<EmailAccountStatus> => {
    const password = data.app_password.replace(/\s+/g, "");
    const { verifyImapLogin } = await import("@/lib/imap-reader.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    try {
      await verifyImapLogin(data.email, password);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("email_accounts").upsert({
        user_id: context.userId,
        email_address: data.email,
        app_password: password,
        status: "disconnected",
        last_error: message,
        last_checked_at: now,
      }, { onConflict: "user_id" });
      throw new Error(message);
    }
    const { error } = await supabaseAdmin.from("email_accounts").upsert({
      user_id: context.userId,
      email_address: data.email,
      app_password: password,
      status: "connected",
      last_error: null,
      last_checked_at: now,
      connected_at: now,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return {
      email_address: data.email,
      status: "connected",
      last_error: null,
      last_checked_at: now,
      connected_at: now,
    };
  });

/** Live re-check used for the real-time connected/disconnected badge. */
export const checkMyEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailAccountStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("email_accounts")
      .select("email_address,app_password,connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.email_address || !row.app_password) return empty;

    const { verifyImapLogin } = await import("@/lib/imap-reader.server");
    const now = new Date().toISOString();
    let status: "connected" | "disconnected" = "connected";
    let last_error: string | null = null;
    try {
      await verifyImapLogin(row.email_address, row.app_password);
    } catch (e) {
      status = "disconnected";
      last_error = e instanceof Error ? e.message : String(e);
    }
    await supabaseAdmin
      .from("email_accounts")
      .update({ status, last_error, last_checked_at: now })
      .eq("user_id", context.userId);
    return {
      email_address: row.email_address,
      status,
      last_error,
      last_checked_at: now,
      connected_at: (row as { connected_at: string | null }).connected_at ?? null,
    };
  });

/** Remove the stored inbox connection. */
export const disconnectMyEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailAccountStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_accounts")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return empty;
  });
