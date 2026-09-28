import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearChunkRecoveryFlag,
  isChunkLoadError,
  recoverFromChunkError,
} from '@/utils/chunkRecovery';

/**
 * Stale-chunk recovery.
 *
 * The contract that matters in production is the cap: a shopper whose tab holds
 * a pre-deploy `index.html` gets exactly one reload, never a loop. These cases
 * assert both halves — that a recognised failure reloads once, and that the
 * second identical failure does not.
 */

const RELOAD_KEY = 'chunk-reload-attempted';

let store: Map<string, string>;
let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = new Map();
  reload = vi.fn();

  vi.stubGlobal('window', {
    location: { reload },
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/Home-OLDHASH.js',
    'Importing a module script failed.',
    'ChunkLoadError: Loading chunk 42 failed.',
    'error loading dynamically imported module',
  ])('recognises %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('ignores ordinary application errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('handles non-Error rejection values without throwing', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('recoverFromChunkError', () => {
  const chunkError = new Error(
    'Failed to fetch dynamically imported module: /assets/Home-OLDHASH.js',
  );

  it('reloads once and records the attempt', () => {
    expect(recoverFromChunkError(chunkError)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(RELOAD_KEY)).toBe('true');
  });

  it('does not reload a second time in the same session', () => {
    recoverFromChunkError(chunkError);
    reload.mockClear();

    expect(recoverFromChunkError(chunkError)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads for unrelated errors', () => {
    expect(recoverFromChunkError(new Error('Payment declined'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(store.has(RELOAD_KEY)).toBe(false);
  });

  it('declines to reload when sessionStorage is unavailable', () => {
    vi.stubGlobal('window', {
      location: { reload },
      sessionStorage: {
        getItem: () => {
          throw new Error('The operation is insecure.');
        },
        setItem: () => {
          throw new Error('The operation is insecure.');
        },
        removeItem: () => {
          throw new Error('The operation is insecure.');
        },
      },
    });

    expect(recoverFromChunkError(chunkError)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('allows recovery again after the flag is cleared by a healthy load', () => {
    recoverFromChunkError(chunkError);
    clearChunkRecoveryFlag();
    reload.mockClear();

    expect(recoverFromChunkError(chunkError)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
