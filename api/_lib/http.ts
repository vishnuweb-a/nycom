import type { VercelRequest, VercelResponse } from '@vercel/node';

import { errorMessage, log, type LogFields } from './log.js';

/**
 * Shared HTTP conventions for the payment functions.
 *
 * The governing rule is that a customer-facing error and a diagnostic error are
 * two different things. The customer gets a short, calm, actionable sentence;
 * the server log gets the detail. Nothing internal — no stack, no gateway
 * response, no credential state — crosses that boundary.
 */

/** A failure that carries a message deliberately written to be shown. */
export class PublicError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PublicError';
    this.status = status;
    this.code = code;
  }
}

/** The generic fallback. Used whenever the real cause must not be disclosed. */
const GENERIC_MESSAGE = 'Something went wrong on our side. Please try again in a moment.';

export const sendJson = (res: VercelResponse, status: number, body: unknown): void => {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
};

export const methodNotAllowed = (res: VercelResponse, allowed: readonly string[]): void => {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed.' } });
};

/**
 * Wraps a handler so an unexpected throw becomes a logged 500 with a generic
 * body, and a `PublicError` becomes its declared status with its own message.
 *
 * Without this, an unhandled rejection in a payment path would surface the raw
 * error text to the shopper — which is exactly where gateway internals and
 * request echoes tend to end up.
 */
export const withErrorHandling =
  (event: string, handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) =>
  async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof PublicError) {
        log.warn(`${event}.rejected`, { code: error.code, status: error.status });
        sendJson(res, error.status, { error: { code: error.code, message: error.message } });

        return;
      }

      log.error(`${event}.failed`, { reason: errorMessage(error) });

      if (!res.headersSent) {
        sendJson(res, 500, { error: { code: 'internal_error', message: GENERIC_MESSAGE } });
      }
    }
  };

/** Logs a payment state transition. Fields are redacted by the logger. */
export const logTransition = (event: string, fields: LogFields): void => {
  log.info(event, fields);
};
