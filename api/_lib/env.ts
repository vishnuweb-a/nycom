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
   * Currently unused.
   *
   * The merchant identified this as the OAuth2 `client_secret`, but the live
   * gateway rejects it — "Invalid client id or secret" — and accepts
   * AIRPAY_SECRET_KEY instead. It is kept required rather than removed because
   * it is an issued credential that may belong to another Airpay product, and
   * dropping it would lose the value. Worth confirming with Airpay what it is
   * for.
   */
  AIRPAY_API_KEY: z.string().min(1, 'AIRPAY_API_KEY is required'),
  /**
   * Serves two roles, both confirmed against the live gateway: the OAuth2
   * `client_secret`, and the `secret` in the privatekey derivation.
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
