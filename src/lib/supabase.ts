import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

/**
 * Shared Supabase client.
 *
 * Uses the anon key, which is public by design — every table is protected by
 * Row Level Security, and the public policies grant read access to active rows
 * plus insert-only access to the submission tables. Auth persistence is off
 * because the MVP is guest-only; it is enabled when authentication ships.
 */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
