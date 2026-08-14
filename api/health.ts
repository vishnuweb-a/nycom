import type { VercelRequest, VercelResponse } from '@vercel/node';

import { serverEnv } from './_lib/env.js';
import { methodNotAllowed, sendJson, withErrorHandling } from './_lib/http.js';
import { errorMessage, log } from './_lib/log.js';

/**
 * Deployment health check.
 *
 * Confirms two things that are otherwise awkward to verify: that `/api/*` is
 * reaching a function rather than being swallowed by the SPA catch-all rewrite,
 * and that the server environment parses.
 *
 * The HTTP response reports only *whether* configuration is present. No value,
 * no length, no prefix, and no name of a missing variable — an unauthenticated
 * endpoint must not become a map of what to attack.
 *
 * The names of the missing variables do go to the server log, which only the
 * project owner can read. `serverEnv` builds that message from variable names
 * alone and never includes a value, so this is safe to log and is the only way
 * to tell *which* variable is absent without leaking the list publicly.
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
  } catch (error) {
    configured = false;
    log.warn('health.env_incomplete', { detail: errorMessage(error) });
  }

  sendJson(res, 200, { ok: true, configured, airpayEnv });
};

export default withErrorHandling('health', handler);
