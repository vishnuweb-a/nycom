/**
 * Structured, redacting logger.
 *
 * Payment code handles a client secret, an API key, a merchant password, a
 * derived private key and a bearer token. Any of them reaching a log sink is a
 * credential disclosure, and logs are the easiest place for one to leak: a
 * caught error object, a request body echoed for debugging, a stack trace.
 *
 * So this module never accepts free-form objects for logging. Callers pass a
 * flat record of primitives, and every value is passed through a redactor that
 * drops anything whose key looks sensitive. It is deliberately more work to log
 * a secret than not to.
 */

/** Substrings that mark a field as unloggable, matched case-insensitively. */
const SENSITIVE_KEY_PATTERN =
  /secret|password|passwd|api[_-]?key|client[_-]?secret|privatekey|private[_-]?key|token|authorization|encdata|checksum|credential/i;

export type LogValue = string | number | boolean | null | undefined;

export type LogFields = Readonly<Record<string, LogValue>>;

const REDACTED = '[redacted]';

/** Replaces the value of any sensitive-looking key. */
const redact = (fields: LogFields): Record<string, LogValue> => {
  const safe: Record<string, LogValue> = {};

  for (const [key, value] of Object.entries(fields)) {
    safe[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : value;
  }

  return safe;
};

const emit = (level: 'info' | 'warn' | 'error', event: string, fields: LogFields): void => {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...redact(fields),
  });

  // Vercel captures stdout/stderr per invocation. `warn` and `error` are the
  // only console methods the lint config permits, and info-level payment
  // transitions are worth keeping, so they ride on `warn` rather than being
  // dropped. The `level` field, not the stream, carries the severity.
  if (level === 'error') {
    console.error(line);
  } else {
    console.warn(line);
  }
};

export const log = {
  info: (event: string, fields: LogFields = {}) => {
    emit('info', event, fields);
  },
  warn: (event: string, fields: LogFields = {}) => {
    emit('warn', event, fields);
  },
  error: (event: string, fields: LogFields = {}) => {
    emit('error', event, fields);
  },
};

/**
 * Reduces an unknown thrown value to a loggable message.
 *
 * Errors raised by this codebase are written not to embed credentials, but a
 * third-party client could attach a request body to its error. The message is
 * truncated and the stack is dropped, so a leak cannot be unbounded.
 */
export const errorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);

  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
};
