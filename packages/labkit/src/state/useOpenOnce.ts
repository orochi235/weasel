import { isDev } from '@weasel-js/react';
import { useEffect, useRef, useState } from 'react';

interface Closable {
  close(): Promise<void> | void;
}

interface Entry<T> {
  value: T | null;
  pending: Promise<T> | null;
  mounts: number;
}

function openEntry<T>(open: () => T | Promise<T>): Entry<T> {
  const result = open();
  if (!(result instanceof Promise)) return { value: result, pending: null, mounts: 0 };
  // The effect that reports a rejection attaches after this tick.
  result.catch(() => {});
  return { value: null, pending: result, mounts: 0 };
}

/**
 * Open something once for a component's lifetime: at once when `open` returns
 * a value, after it settles when it returns a promise. A rejected open is
 * thrown from render, for an error boundary. Closed on unmount — but
 * the close waits a microtask, and the remount React StrictMode performs right
 * after its rehearsal unmount cancels it, so StrictMode opens it once.
 */
export function useOpenOnce<T extends Closable>(open: () => T | Promise<T>): T | null {
  const entry = useRef<Entry<T> | null>(null);
  if (entry.current === null) entry.current = openEntry(open);
  const [value, setValue] = useState<T | null>(entry.current.value);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  if (failure) throw failure.error;

  useEffect(() => {
    const e = entry.current as Entry<T>;
    e.mounts += 1;
    let live = true;
    void e.pending?.then(
      (opened) => {
        e.value = opened;
        if (live) setValue(opened);
      },
      (error: unknown) => {
        if (live) setFailure({ error });
      },
    );
    return () => {
      live = false;
      e.mounts -= 1;
      queueMicrotask(() => {
        if (e.mounts > 0) return;
        if (e.value) void e.value.close();
        else
          void e.pending?.then(
            (opened) => {
              if (e.mounts === 0) void opened.close();
            },
            () => {},
          );
      });
    };
  }, []);

  return value;
}

/** Warn once, in development, when a prop read only at mount changes after it. */
export function useWarnIgnoredChange(component: string, props: Record<string, unknown>): void {
  const first = useRef(props);
  const warned = useRef(false);
  // In an effect, so only props that committed are compared.
  useEffect(() => {
    if (!isDev() || warned.current) return;
    for (const key of Object.keys(props)) {
      if (Object.is(first.current[key], props[key])) continue;
      warned.current = true;
      console.warn(
        `[labkit] ${component} reads \`${key}\` once, at mount; a later change is ignored`,
      );
      return;
    }
  });
}
