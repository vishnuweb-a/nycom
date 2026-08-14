import type { VercelRequest, VercelResponse } from '@vercel/node';

import { serverEnv } from './_lib/env.js';
import { methodNotAllowed, sendJson, withErrorHandling } from './_lib/http.js';

/**
 * Deployment health check.
 *
 * Confirms two things that are otherwise awkward to verify: that `/api/*` is
 * reaching a function rather than being swallowed by the SPA catch-all rewrite,
 * and that the server environment parses.
 *
 * It reports only whether configuration is present and which Airpay environment
 * is selected. No value, no length, no prefix, no variable name that is missing
 * — an unauthenticated endpoint must not become a map of what to attack.
 */
const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);

    return;
  }

  await Promise.resolve();

  let configured = false;
  let airpayEnv: string | null = null;

  try {
    airpayEnv = serverEnv().AIRPAY_ENV;
    configured = true;
  } catch {
    configured = false;
  }

  sendJson(res, 200, { ok: true, configured, airpayEnv });
};

export default withErrorHandling('health', handler);
