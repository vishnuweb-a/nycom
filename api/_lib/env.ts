import { z } from 'zod';

/**
 * Validated server environment.
 *
 * Mirrors the discipline of `src/lib/env.ts`, but for the Vercel Functions
 * runtime. Nothing here is ever bundled into the browser: none of these names
 * carry a `VITE_` prefix, so Vite cannot inline them even by accident.
 *
 * Parsing happens lazily rather than at module load. A payment credential
 * missing in a preview deployment should fail the one request that needs it
 * with an actionable message, not crash every function in the project —
 * including the health check you would use to diagnose it.
 */

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE: z.string().min(1, 'SUPABASE_SERVICE_ROLE is required'),

  AIRPAY_MID: z.string().min(1, 'AIRPAY_MID is required'),
  AIRPAY_CLIENT_ID: z.string().min(1, 'AIRPAY_CLIENT_ID is required'),
  /**
   * The `secret` in the privatekey derivation — verified against the live
   * gateway, which resolves the merchant from that derived value.
   */
  AIRPAY_API_KEY: z.string().min(1, 'AIRPAY_API_KEY is required'),
  /**
   * The OAuth2 `client_secret` — verified against the live gateway.
   *
   * Note these two are the reverse of what was originally assumed. The merchant
   * identified AIRPAY_API_KEY as the OAuth secret; the gateway rejects it in
   * that role and accepts it as the privatekey secret, and vice versa.
   */
  AIRPAY_SECRET_KEY: z.string().min(1, 'AIRPAY_SECRET_KEY is required'),
  AIRPAY_USERNAME: z.string().min(1, 'AIRPAY_USERNAME is required'),
  AIRPAY_PASSWORD: z.string().min(1, 'AIRPAY_PASSWORD is required'),

  /**
   * Explicit, never inferred. Airpay's Order Confirmation API works only
   * against a live MID, and that single fact decides whether a payment can be
   * trusted at all — guessing it wrong is a money bug.
   */
  AIRPAY_ENV: z.enum(['live', 'sandbox']),

  /**
   * Overrides the Airpay Order Confirmation endpoint.
   *
   * Optional, and normally unset — the default is the documented production
   * path. It exists because merchants can be onboarded onto a different
   * verification path, and because pointing verification at a local double is
   * the only way to exercise the real request against something other than the
   * live gateway.
   */
  AIRPAY_VERIFY_URL: z.string().url().optional(),

  PUBLIC_SITE_ORIGIN: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Returns the validated server environment.
 *
 * Throws a message listing every missing variable by name. Names are safe to
 * print; values never are, and none appear in the error.
 */
export const serverEnv = (): ServerEnv => {
  if (cached !== null) {
    return cached;
  }

  const parsed = serverEnvSchema.safeParse({
    // The browser client reads VITE_SUPABASE_URL; the same project URL is not a
    // secret, so accept either name rather than forcing a duplicate variable.
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
    AIRPAY_MID: process.env.AIRPAY_MID,
    AIRPAY_CLIENT_ID: process.env.AIRPAY_CLIENT_ID,
    AIRPAY_API_KEY: process.env.AIRPAY_API_KEY,
    AIRPAY_SECRET_KEY: process.env.AIRPAY_SECRET_KEY,
    AIRPAY_USERNAME: process.env.AIRPAY_USERNAME,
    AIRPAY_PASSWORD: process.env.AIRPAY_PASSWORD,
    AIRPAY_ENV: process.env.AIRPAY_ENV,
    /*
     * Normalised to `undefined` when blank. A variable defined-but-empty in a
     * Vercel project is easy to create by accident, and left as `''` it fails
     * the URL check — which would not merely disable the override, it would
     * invalidate the whole environment and take every payment down with it.
     */
    AIRPAY_VERIFY_URL:
      process.env.AIRPAY_VERIFY_URL?.trim() === '' ? undefined : process.env.AIRPAY_VERIFY_URL,
    PUBLIC_SITE_ORIGIN: process.env.PUBLIC_SITE_ORIGIN,
  });

  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];

    throw new Error(`Server environment is incomplete or invalid: ${names.join(', ')}`);
  }

  cached = parsed.data;

  return cached;
};

/** True when running against a live merchant ID. Gates Order Confirmation. */
export const isLiveMid = (): boolean => serverEnv().AIRPAY_ENV === 'live';
