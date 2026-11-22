import { useLatest } from '@weasel-js/core';
import { useVisibleRaf } from '@weasel-js/react';
import { deepEqual } from '@weasel-js/registry';
import { useEffect, useRef, useState } from 'react';

/**
 * `read()`, read fresh at every render, and read again on every visible frame so the caller re-renders when the
 * answer changes — for a value that moves outside React, such as a camera a host pans on its own.
 */
export function useFollowed<T>(read: (() => T) | undefined): T | undefined {
  const readRef = useLatest(read);
  const seen = useRef<{ value: T } | null>(null);
  const [, setSeen] = useState<{ value: T } | null>(null);
  const following = read !== undefined;
  const loop = useVisibleRaf((_time, loop) => {
    const r = readRef.current;
    if (!r) return;
    loop.request();
    const value = r();
    if (seen.current && deepEqual(seen.current.value, value)) return;
    seen.current = { value };
    setSeen(seen.current);
  });
  useEffect(() => {
    if (!following) return;
    loop.request();
    return () => loop.cancel();
  }, [loop, following]);
  return read?.();
}
