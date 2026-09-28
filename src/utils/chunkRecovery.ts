/**
 * Recovery from stale code-split chunks.
 *
 * Every route in `router/AppRouter.tsx` is loaded with a hashed dynamic import.
 * A deploy replaces those hashes, so a tab that was opened before the deploy
 * holds an `index.html` pointing at chunk URLs that no longer exist: the next
 * navigation throws instead of rendering. A single reload fetches the current
 * `index.html` and fixes it.
 *
 * The reload is deliberately capped at one attempt per tab session. If the page
 * still fails after reloading, the cause is not a stale chunk and reloading
 * again would only spin — the error is surfaced through the normal boundary UI.
 */

const CHUNK_RELOAD_KEY = 'chunk-reload-attempted';

/** Messages browsers and Vite produce when a hashed chunk has gone missing. */
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i;

/**
 * `sessionStorage` throws outright in Safari's private mode and when a browser
 * blocks site data, so every access is guarded: recovery is a nice-to-have and
 * must never become the reason a page fails to render.
 */
const readAttempted = (): boolean => {
  try {
    return window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === 'true';
  } catch {
    // Storage unavailable — treat as "already attempted" so no loop is possible.
    return true;
  }
};

const markAttempted = (): boolean => {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
    return true;
  } catch {
    return false;
  }
};

/** True when `error` is a missing-chunk failure rather than an application bug. */
export const isChunkLoadError = (error: unknown): boolean => {
  // Only `Error.message` and bare string rejections are inspected. Stringifying
  // an arbitrary object would yield '[object Object]' and never match anyway.
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  return CHUNK_ERROR_PATTERN.test(message);
};

/**
 * Reloads once when `error` is a stale-chunk failure and no reload has been
 * attempted yet in this tab.
 *
 * @returns `true` when a reload was triggered, meaning the caller should render
 *   nothing further. `false` leaves the error to be reported normally.
 */
export const recoverFromChunkError = (error: unknown): boolean => {
  if (!isChunkLoadError(error) || readAttempted() || !markAttempted()) {
    return false;
  }

  window.location.reload();

  return true;
};

/**
 * Clears the guard so a *later* deploy can be recovered in this same tab.
 *
 * Call only once the app has actually rendered — clearing it while the failing
 * chunk could still be retried would re-arm the reload and loop.
 */
export const clearChunkRecoveryFlag = (): void => {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
};
