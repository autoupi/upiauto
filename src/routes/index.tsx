import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) throw redirect({ to: "/generate" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as any)) throw e;
      // Supabase not configured yet — send the user to the sign-in screen.
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
