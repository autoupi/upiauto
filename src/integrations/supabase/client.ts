// Supabase browser client.
// The URL + publishable (anon) key are public values, so we keep safe fallbacks
// here. That way the app still boots on hosts (e.g. Vercel) where the
// VITE_SUPABASE_* build-time env vars were not configured.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const FALLBACK_URL = 'https://fzhyobhoqifbojjmktrw.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aHlvYmhvcWlmYm9qam1rdHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDg3MDYsImV4cCI6MjEwMzcyNDcwNn0.PAca-G-xtcdGe4eMCDQ2ji9bPGpgowxlug0n0baGQ30';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  FALLBACK_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
