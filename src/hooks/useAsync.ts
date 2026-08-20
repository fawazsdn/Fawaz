import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
}

/**
 * Small, dependency-free async data hook used across the app to call a
 * service function and expose loading / refreshing / error states plus a
 * `refetch`/`refresh` pair for pull-to-refresh. Kept intentionally simple
 * (no cache) — screens read live data from the zustand store for anything
 * that must update instantly after a local mutation.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { refetch: () => void; refresh: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, loading: true, refreshing: false, error: null });
  const mounted = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback((isRefresh: boolean) => {
    setState((s) => ({ ...s, loading: !isRefresh, refreshing: isRefresh, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (mounted.current) setState({ data, loading: false, refreshing: false, error: null });
      })
      .catch((error: Error) => {
        if (mounted.current) setState((s) => ({ ...s, loading: false, refreshing: false, error }));
      });
  }, []);

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => {
    return new Promise<void>((resolve) => {
      setState((s) => ({ ...s, refreshing: true, error: null }));
      fnRef
        .current()
        .then((data) => {
          if (mounted.current) setState({ data, loading: false, refreshing: false, error: null });
          resolve();
        })
        .catch((error: Error) => {
          if (mounted.current) setState((s) => ({ ...s, loading: false, refreshing: false, error }));
          resolve();
        });
    });
  }, []);

  return { ...state, refetch, refresh };
}
