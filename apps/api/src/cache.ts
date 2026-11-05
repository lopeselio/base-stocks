/**
 * Tiny TTL cache with in-flight de-duplication, so a burst of requests triggers one RPC fan-out.
 * Serves the last good value if a refresh fails (RPC hiccups shouldn't blank the UI).
 */
export function cached<T>(ttlMs: number, load: () => Promise<T>) {
  let value: T | undefined;
  let at = 0;
  let inflight: Promise<T> | undefined;

  return async (): Promise<T> => {
    if (value !== undefined && Date.now() - at < ttlMs) return value;
    inflight ??= load()
      .then((v) => {
        value = v;
        at = Date.now();
        return v;
      })
      .catch((e) => {
        if (value !== undefined) return value;
        throw e;
      })
      .finally(() => {
        inflight = undefined;
      });
    return inflight;
  };
}

/** Same as `cached`, keyed (e.g. per basket address). */
export function cachedBy<K, T>(ttlMs: number, load: (k: K) => Promise<T>) {
  const map = new Map<K, () => Promise<T>>();
  return (k: K) => {
    let fn = map.get(k);
    if (!fn) {
      fn = cached(ttlMs, () => load(k));
      map.set(k, fn);
    }
    return fn();
  };
}
