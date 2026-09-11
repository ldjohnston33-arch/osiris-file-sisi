'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/** Client clock. Returns `fallback` during SSR/hydration, then ticks every minute. */
export function useNow(fallback: string): number {
  const [now, setNow] = useState(() => Date.parse(fallback));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  return now;
}

const LOCAL_EVENT = 'osiris-file:local-change';

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new Event(LOCAL_EVENT));
  } catch {
    /* private mode / blocked storage: feature degrades silently */
  }
}

function subscribeLocal(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(LOCAL_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(LOCAL_EVENT, cb);
  };
}

/** A localStorage value that stays in sync with writes (null on the server). */
export function useLocalValue(key: string): string | null {
  return useSyncExternalStore(subscribeLocal, () => readLocal(key), () => null);
}

/** A localStorage value frozen at page load, e.g. "last visit" for NEW badges. */
const initialValues = new Map<string, string | null>();
const noopSubscribe = () => () => {};
export function useInitialLocalValue(key: string): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      if (!initialValues.has(key)) initialValues.set(key, readLocal(key));
      return initialValues.get(key) ?? null;
    },
    () => null,
  );
}

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    cb => {
      const mq = window.matchMedia(q);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}
