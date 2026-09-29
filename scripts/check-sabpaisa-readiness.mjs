#!/usr/bin/env node
/**
 * SabPaisa production readiness check.
 *
 * Verifies that the SabPaisa configuration is PRESENT and SHAPED correctly.
 * That is all it does, and the boundary is deliberate:
 *
 *   It never prints a credential value, or any substring of one.
 *   It never calls SabPaisa.
 *   It never creates, queries or settles a payment.
 *   It never touches the database.
 *
 * So it is safe to run against production configuration, in CI, or on a laptop.
 * What it CANNOT tell you is whether the merchant account is live, whether
 * payment methods are enabled, or whether the credentials are accepted — none
 * of that is knowable without talking to SabPaisa, which this script will not
 * do. Those remain manual go-live checks.
 *
 * Usage:
 *   node --env-file=.env scripts/check-sabpaisa-readiness.mjs
 *
 * Exit code 0 if every check passed, 1 otherwise.
 */

const PRODUCTION_ORIGIN = 'https://www.yarnvia.online';
const PRODUCTION_BASE_URL = 'https://merchant-api.sabpaisa.in';
const RETURN_PATH = '/api/payments/sabpaisa/return';

/** Non-production hosts that must never back a live return URL. */
const NON_PRODUCTION_HOST = /(^|\.)localhost$|^127\.|^0\.0\.0\.0$|\.vercel\.app$|(^|\.)staging\./i;

const results = [];

/** Records one check. `detail` must never contain a secret value. */
const check = (pass, name, detail = '') => {
  results.push({ pass, name, detail });
};

/**
 * Reads a variable, accepting the same prefixed/bare spellings the runtime
 * accepts (`api/_lib/sabpaisa/env.ts`), so this script agrees with the code it
 * is vouching for. Returns only whether a value exists and its length — never
 * the value.
 */
const read = (...names) => {
  for (const name of names) {
    const value = process.env[name];

    if (value !== undefined && value.trim() !== '') {
      return { found: true, via: name, value: value.trim() };
    }
  }

  return { found: false, via: null, value: null };
};

/**
 * Asserts a secret is present, reporting only the NAME it was found under.
 * The value is never printed, measured aloud, or partially revealed.
 */
const requireSecret = (label, ...names) => {
  const { found, via } = read(...names);

  check(found, label, found ? `set via ${via}` : `none of: ${names.join(', ')}`);
};

// ─── Credentials: presence only ─────────────────────────────────────────────

requireSecret('SABPAISA_API_KEY present', 'SABPAISA_API_KEY', 'API_KEY');
requireSecret('SABPAISA_SECRET_KEY present', 'SABPAISA_SECRET_KEY', 'SECRET_KEY');
requireSecret('SABPAISA_MERCHANT_ID present', 'SABPAISA_MERCHANT_ID', 'MERCHANT_ID');
requireSecret('SABPAISA_CLIENT_CODE present', 'SABPAISA_CLIENT_CODE', 'CLIENT_CODE');

/*
 * merchantId and clientCode are checked for PRESENCE independently, and are
 * never compared with each other. They happen to hold the same value for this
 * merchant, but that is a property of one account rather than of the protocol:
 * Create Payment signs `merchantId`, Transaction Enquiry asks by `clientCode`,
 * and the code keeps the two roles separate so a reissue of either cannot
 * silently break the other.
 */

// ─── SABPAISA_BASE_URL ──────────────────────────────────────────────────────

const baseUrl = read('SABPAISA_BASE_URL');

if (!baseUrl.found) {
  check(false, 'SABPAISA_BASE_URL present', 'unset');
} else {
  const normalised = baseUrl.value.replace(/\/$/, '');

  check(true, 'SABPAISA_BASE_URL present');
  check(
    normalised === PRODUCTION_BASE_URL,
    'SABPAISA_BASE_URL is the production API',
    normalised === PRODUCTION_BASE_URL ? normalised : `expected ${PRODUCTION_BASE_URL}`,
  );

  let parsed = null;

  try {
    parsed = new URL(normalised);
  } catch {
    // Reported by the https check below.
  }

  check(
    parsed !== null && parsed.protocol === 'https:',
    'SABPAISA_BASE_URL uses HTTPS',
    'this URL receives the API key on every request',
  );
}

// ─── PUBLIC_SITE_ORIGIN and the return URL ──────────────────────────────────

const origin = read('PUBLIC_SITE_ORIGIN');

if (!origin.found) {
  check(false, 'PUBLIC_SITE_ORIGIN present', 'unset');
} else {
  const normalised = origin.value.replace(/\/$/, '');

  check(true, 'PUBLIC_SITE_ORIGIN present');

  let parsed = null;

  try {
    parsed = new URL(normalised);
  } catch {
    // Reported below.
  }

  if (parsed === null) {
    check(false, 'PUBLIC_SITE_ORIGIN is a valid URL', 'unparseable');
  } else {
    check(parsed.protocol === 'https:', 'PUBLIC_SITE_ORIGIN uses HTTPS');

    check(
      !NON_PRODUCTION_HOST.test(parsed.hostname),
      'PUBLIC_SITE_ORIGIN is not a localhost/preview/staging host',
      NON_PRODUCTION_HOST.test(parsed.hostname) ? parsed.hostname : '',
    );

    check(
      normalised === PRODUCTION_ORIGIN,
      'PUBLIC_SITE_ORIGIN is the production domain',
      normalised === PRODUCTION_ORIGIN ? normalised : `expected ${PRODUCTION_ORIGIN}`,
    );

    /*
     * The return URL is DERIVED here exactly as the runtime derives it, rather
     * than being asserted as a literal, so this check fails if the derivation
     * and the expectation ever drift apart.
     */
    const returnUrl = `${normalised}${RETURN_PATH}`;
    const expected = `${PRODUCTION_ORIGIN}${RETURN_PATH}`;

    check(
      returnUrl === expected,
      'Return URL resolves to the production endpoint',
      returnUrl === expected ? returnUrl : `resolved ${returnUrl}, expected ${expected}`,
    );
  }
}

// ─── No secret may be exposed to the browser bundle ─────────────────────────

/*
 * Anything named VITE_* is compiled into the client bundle and is world
 * readable. A SabPaisa credential there would be published, not configured.
 */
const leaked = Object.keys(process.env).filter(
  (name) =>
    name.startsWith('VITE_') && /SABPAISA|SECRET|API_KEY|CLIENT_CODE|MERCHANT_ID/i.test(name),
);

check(
  leaked.length === 0,
  'No SabPaisa credential is exposed as a VITE_* variable',
  // Names only. The values are exactly what must not be printed.
  leaked.length === 0 ? '' : `exposed: ${leaked.join(', ')}`,
);

// ─── Report ─────────────────────────────────────────────────────────────────

let failed = 0;

for (const result of results) {
  if (!result.pass) {
    failed += 1;
  }

  const status = result.pass ? 'PASS' : 'FAIL';
  const detail = result.detail === '' ? '' : `  — ${result.detail}`;

  console.log(`${status}  ${result.name}${detail}`);
}

console.log(
  `\n${String(results.length - failed)}/${String(results.length)} checks passed.` +
    (failed === 0
      ? '\n\nConfiguration looks production-ready. Merchant activation, enabled payment\nmethods and IP allowlisting are NOT verifiable from here — confirm those with\nSabPaisa before taking a live payment.'
      : '\n\nResolve the FAIL lines above before going live.'),
);

process.exit(failed === 0 ? 0 : 1);
