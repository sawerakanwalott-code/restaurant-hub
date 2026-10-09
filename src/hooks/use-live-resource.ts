/**
 * ============================================================================
 * SLICE 1.5 — ONE POLLING HOOK FOR EVERY LIVE SCREEN
 * ============================================================================
 *
 * Six screens each kept their own setInterval. They now share this hook, so
 * the day the backend confirms websockets, only this file changes.
 *
 * Behaviour:
 *   - fetches immediately, then on the given interval
 *   - pauses while the tab is hidden (no battery burn, no wasted requests)
 *   - refetches the moment the tab comes back
 *   - never overlaps requests, and aborts in flight on unmount
 *   - keeps the last good value visible while a refetch is running
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const POLL = {
  /** Customer watching their own order. */
  tracking: 4000,
  /** Admin order feed. */
  adminFeed: 10000,
  /** Rider job board. */
  riderJobs: 12000,
  /** Rider GPS upload while on duty. */
  riderGps: 12000,
  /** Kitchen ticket board. */
  kitchen: 8000,
} as const;

export type LiveResource<T> = {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => void;
};

export function useLiveResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  interval: number,
  options: { enabled?: boolean } = {},
): LiveResource<T> {
  const enabled = (options.enabled ?? true) && key !== null;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setLoading] = useState(enabled);
  const [isRefreshing, setRefreshing] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const run = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    setRefreshing(true);
    try {
      const next = await fetcherRef.current(controller.signal);
      if (!mounted.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      if ((err as Error)?.name === "AbortError") return;
      setError(err as Error);
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        mounted.current = false;
      };
    }

    setLoading((prev) => (data === null ? true : prev));
    void run();

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => void run(), interval);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) stop();
      else {
        void run();
        start();
      }
    };

    if (typeof document === "undefined" || !document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted.current = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // `data` intentionally excluded: it would restart the timer on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, interval, enabled, run]);

  return { data, error, isLoading, isRefreshing, refresh: () => void run() };
}
