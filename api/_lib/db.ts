import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { serverEnv } from './env';

/**
 * Service-role Supabase client — server functions only.
 *
 * This key bypasses Row Level Security entirely. It exists here because the
 * `orders` table deliberately carries no RLS policies at all: the anon key that
 * ships in the browser bundle can neither read nor write an order, so the only
 * way in is through these functions. That is the intended shape — an order row
 * holds a shipping address and the authoritative amount, neither of which the
 * browser may touch.
 *
 * Constructed lazily so a missing credential fails the request that needs it
 * rather than the whole deployment.
 */

let cached: SupabaseClient | null = null;

export const db = (): SupabaseClient => {
  if (cached !== null) {
    return cached;
  }

  const env = serverEnv();

  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
};
