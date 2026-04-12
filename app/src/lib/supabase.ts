import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client. Uses the service role key, which bypasses RLS.
// NEVER import this from a `client:*` Svelte island — it would ship the secret to the browser.
export const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
