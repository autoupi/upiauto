// @lovable.dev/vite-tanstack-config already includes TanStack Start, React, Tailwind,
// tsconfig paths, nitro (cloudflare target by default), VITE_* env injection and the
// @ path alias — do NOT add those plugins manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel sets VERCEL=1 during its build. In that case we build a FULL-STACK bundle
// (SSR + all /api routes + server functions) using nitro's `vercel` preset, so the
// whole gateway — including the IMAP email poller — runs on Vercel. No proxy needed.
const isVercel = process.env.VERCEL === "1" || process.env.BUILD_TARGET === "vercel";

// Self-hosted deploys often only set the server-side names (SUPABASE_URL / *_ANON_KEY).
// Mirror them into the client bundle so the browser client has credentials too.
const clientEnv: Record<string, string> = {};
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;
if (url) clientEnv["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(url);
if (key) clientEnv["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(key);

export default defineConfig({
  vite: { define: clientEnv },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (SSR error wrapper).
    server: { entry: "server" },
  },
  ...(isVercel ? { nitro: { preset: "vercel" } } : {}),
});
