import { z } from 'zod';

/**
 * Validated SabPaisa configuration — deliberately its own module.
 *
 * This does NOT live in `api/_lib/env.ts`, and that separation is a hard
 * requirement rather than a stylistic choice. `serverEnv()` validates the whole
 * Airpay credential set as one schema, so adding SabPaisa fields there would
 * mean a missing or malformed SabPaisa variable invalidates the entire
 * environment — taking Airpay checkout, the Airpay callback and the nightly
 * reconciler down with it. Airpay is currently taking real money; a second
 * provider's misconfiguration must not be able to stop it.
 *
 * So the two are parsed independently and lazily:
 *
 *   an Airpay request  → only Airpay validation runs
 *   a SabPaisa request → only SabPaisa validation runs
 *
 * Nothing here is imported by `env.ts`, `settle.ts`, `airpay.ts` or any Airpay
 * route, so no Airpay code path can even reach this parser.
 */

/**
 * Env name resolution.
 *
 * The merchant's production configuration holds these under bare, unprefixed
 * names (`CLIENT_CODE`, `MERCHANT_ID`, `API_KEY`, `SECRET_KEY`). The prefixed
 * `SABPAISA_*` spellings are preferred because `API_KEY` and `SECRET_KEY` are
 * generic enough to collide with any future provider, but the bare names are
 * accepted so the integration works against the environment as it actually
 * stands today rather than requiring a rename before it can run at all.
 *
 * Prefixed wins when both are set.
 */
const pick = (...names: readonly string[]): string | undefined => {
  for (const name of names) {
    const value = process.env[name];

    if (value !== undefined && value.trim() !== '') {
      return value.trim();
    }
  }

  return undefined;
};

/** Hosts we will POST production credentials to, or redirect a shopper onto. */
const SABPAISA_HOST_SUFFIX = '.sabpaisa.in';

const isSabPaisaHttpsUrl = (value: string): boolean => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === 'https:' &&
    (url.hostname === 'sabpaisa.in' || url.hostname.endsWith(SABPAISA_HOST_SUFFIX))
  );
};

const sabpaisaEnvSchema = z.object({
  /**
   * Transaction Enquiry's merchant identifier. Distinct from `merchantId` by
   * the documentation's own contract, and kept separate here even though this
   * merchant's SabPaisa account happens to have been assigned the same value
   * for both. Conflating them in code would be correct only by coincidence,
   * and would break silently if SabPaisa ever reissued one of them.
   */
  SABPAISA_CLIENT_CODE: z.string().min(1, 'SABPAISA_CLIENT_CODE (or CLIENT_CODE) is required'),

  /** Create Payment's merchant identifier, and part of the checksum. */
  SABPAISA_MERCHANT_ID: z.string().min(1, 'SABPAISA_MERCHANT_ID (or MERCHANT_ID) is required'),

  /** Sent as the `X-Api-Key` header. Never leaves the server. */
  SABPAISA_API_KEY: z.string().min(1, 'SABPAISA_API_KEY (or API_KEY) is required'),

  /** HMAC-SHA256 key for the Create Payment checksum and the return signature. */
  SABPAISA_SECRET_KEY: z.string().min(1, 'SABPAISA_SECRET_KEY (or SECRET_KEY) is required'),

  /**
   * API origin, no trailing slash. Constrained to an HTTPS `*.sabpaisa.in`
   * host: this URL receives the API key on every request, so pointing it at an
   * attacker-controlled or plaintext origin would hand over the credential.
   */
  SABPAISA_BASE_URL: z
    .string()
    .refine(isSabPaisaHttpsUrl, 'SABPAISA_BASE_URL must be an https *.sabpaisa.in URL'),

  /**
   * Canonical production origin. The return URL is derived from it rather than
   * from any request header, so a forged `Host` cannot redirect a live payment
   * off-site.
   */
  PUBLIC_SITE_ORIGIN: z.string().url('PUBLIC_SITE_ORIGIN must be a valid URL'),
});

export type SabPaisaEnv = z.infer<typeof sabpaisaEnvSchema>;

let cached: SabPaisaEnv | null = null;

/**
 * Returns the validated SabPaisa configuration.
 *
 * Throws listing every missing variable BY NAME. Names are safe to print;
 * values never are, and no value appears in the message.
 */
export const sabpaisaEnv = (): SabPaisaEnv => {
  if (cached !== null) {
    return cached;
  }

  const parsed = sabpaisaEnvSchema.safeParse({
    SABPAISA_CLIENT_CODE: pick('SABPAISA_CLIENT_CODE', 'CLIENT_CODE'),
    SABPAISA_MERCHANT_ID: pick('SABPAISA_MERCHANT_ID', 'MERCHANT_ID'),
    SABPAISA_API_KEY: pick('SABPAISA_API_KEY', 'API_KEY'),
    SABPAISA_SECRET_KEY: pick('SABPAISA_SECRET_KEY', 'SECRET_KEY'),
    SABPAISA_BASE_URL: pick('SABPAISA_BASE_URL')?.replace(/\/$/, ''),
    PUBLIC_SITE_ORIGIN: pick('PUBLIC_SITE_ORIGIN')?.replace(/\/$/, ''),
  });

  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];

    throw new Error(`SabPaisa configuration is incomplete or invalid: ${names.join(', ')}`);
  }

  cached = parsed.data;

  return cached;
};

/** Test-only: drops the memoised config so a case can vary `process.env`. */
export const resetSabPaisaEnvCache = (): void => {
  cached = null;
};

// ─── The production return URL ──────────────────────────────────────────────

/**
 * Origins that must never be registered as a live SabPaisa return URL.
 *
 * A preview or localhost return URL on a production merchant is not a cosmetic
 * mistake: the shopper's browser is handed back to a deployment that is not the
 * live site, and the payment silently fails to settle on the real one.
 */
const NON_PRODUCTION_HOST = /(^|\.)localhost$|^127\.|^0\.0\.0\.0$|\.vercel\.app$|(^|\.)staging\./i;

/**
 * The absolute SabPaisa return URL, derived from `PUBLIC_SITE_ORIGIN`.
 *
 * Built from configuration and never from a request header. Rejects plaintext
 * and non-production origins outright — failing a payment's creation is
 * strictly better than taking money and losing the confirmation.
 */
export const sabpaisaReturnUrl = (): string => {
  const origin = sabpaisaEnv().PUBLIC_SITE_ORIGIN;
  const url = new URL(origin);

  if (url.protocol !== 'https:') {
    throw new Error('PUBLIC_SITE_ORIGIN must be https for a live SabPaisa return URL');
  }

  if (NON_PRODUCTION_HOST.test(url.hostname)) {
    throw new Error(
      'PUBLIC_SITE_ORIGIN resolves to a non-production host; refusing to build a live SabPaisa return URL',
    );
  }

  return `${origin.replace(/\/$/, '')}/api/payments/sabpaisa/return`;
};

/**
 * Whether a URL returned by SabPaisa is safe to redirect a shopper onto.
 *
 * Checked before every redirect. The hosted checkout host is whatever SabPaisa
 * returns — never hardcoded, never reconstructed — but it must still be HTTPS
 * and inside SabPaisa's own domain, or a compromised or misconfigured API
 * response could send a paying customer to a phishing page.
 */
export const isApprovedCheckoutUrl = (value: string): boolean => isSabPaisaHttpsUrl(value);
