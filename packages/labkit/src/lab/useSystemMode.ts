import { useEffect, useState } from 'react';
import type { LabMode } from '../state/types';

function query(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  return window.matchMedia('(prefers-color-scheme: light)');
}

/**
 * Resolve a `LabMode` to the mode the theme resolver understands.
 *
 * `auto` is not a mode — it means "read the OS", live. An explicit choice
 * opts out of the subscription entirely.
 */
export function useResolvedMode(mode: LabMode): 'light' | 'dark' {
  const [system, setSystem] = useState<'light' | 'dark'>(() =>
    query()?.matches ? 'light' : 'dark',
  );

  useEffect(() => {
    if (mode !== 'auto') return;
    const mq = query();
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  return mode === 'auto' ? system : mode;
}
