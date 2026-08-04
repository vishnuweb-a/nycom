import { useCallback, useEffect, useState } from 'react';

export type AsyncStatus = 'loading' | 'success' | 'error';

interface AsyncState<T> {
  readonly data: T | null;
  readonly status: AsyncStatus;
  readonly error: string | null;
}

export interface AsyncData<T> extends AsyncState<T> {
  /** Re-runs the fetch. Wired to the retry action on error states. */
  readonly retry: () => void;
}

const INITIAL: AsyncState<never> = { data: null, status: 'loading', error: null };

/**
 * Runs an async loader and exposes loading, success and error states.
 *
 * The loader receives an `AbortSignal` and must forward it, so a fetch still in
 * flight when the component unmounts — or when `retry` supersedes it — is
 * cancelled rather than resolving into a dead component.
 *
 * State is a single object updated only from async callbacks and event
 * handlers, never synchronously inside the effect body, which would trigger a
 * cascading re-render on every mount.
 *
 * `fetcher` must be stable (module-level function or wrapped in `useCallback`);
 * an inline arrow would re-run the effect on every render.
 */
export const useAsyncData = <T>(fetcher: (signal: AbortSignal) => Promise<T>): AsyncData<T> => {
  const [state, setState] = useState<AsyncState<T>>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState(INITIAL);
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetcher(controller.signal)
      .then((result) => {
        if (active) {
          setState({ data: result, status: 'success', error: null });
        }
      })
      .catch((cause: unknown) => {
        // An abort is an intentional cancellation, not a failure to report.
        if (!active || controller.signal.aborted) {
          return;
        }

        setState({
          data: null,
          status: 'error',
          error: cause instanceof Error ? cause.message : 'Something went wrong.',
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [fetcher, attempt]);

  return { ...state, retry };
};
