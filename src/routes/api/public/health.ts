import { createFileRoute } from "@tanstack/react-router";

// Diagnostics: open https://<your-vercel-domain>/api/public/health
// It never prints secret values, only whether each variable is present.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const has = (n: string) => Boolean(process.env[n] && process.env[n]!.trim());

         // Prove the Node-only email reader can actually be loaded in this runtime.
         let imap: { loadable: boolean; error?: string } = { loadable: false };
         try {
           await import("@/lib/imap-reader.server");
           imap = { loadable: true };
         } catch (e) {
           imap = { loadable: false, error: e instanceof Error ? e.message : String(e) };
         }

        const body = {
          ok: true,
          host: new URL(request.url).host,
          runtime: typeof process !== "undefined" ? (process.version || "unknown") : "edge",
          imap,
          // /api/public/health?probe=imap -> proves the runtime can open a TLS
          // socket to Gmail (expected result: an authentication error, not a
          // connection/close error).
          imap_probe: new URL(request.url).searchParams.get("probe") === "imap"
             ? await (async () => {
                 try {
                   const { imapVerify } = await import("@/lib/imap-lite.server");
                   await imapVerify("imap.gmail.com", 993, "probe@example.com", "probe-password");
                   return "unexpected-success";
                 } catch (e) {
                   return e instanceof Error ? e.message : String(e);
                 }
               })()
             : "skipped",
          env: {
             SUPABASE_URL: has("SUPABASE_URL") || has("VITE_SUPABASE_URL"),
             SUPABASE_PUBLISHABLE_KEY:
               has("SUPABASE_PUBLISHABLE_KEY") ||
               has("SUPABASE_ANON_KEY") ||
               has("VITE_SUPABASE_PUBLISHABLE_KEY") ||
               has("VITE_SUPABASE_ANON_KEY"),
             SUPABASE_SERVICE_ROLE_KEY: has("SUPABASE_SERVICE_ROLE_KEY"),
             GMAIL_IMAP_USER: has("GMAIL_IMAP_USER"),
             GMAIL_APP_PASSWORD: has("GMAIL_APP_PASSWORD"),
          },
        };
        return new Response(JSON.stringify(body, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
