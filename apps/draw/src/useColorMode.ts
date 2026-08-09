import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'wd-mode';

export type ColorMode = 'dark' | 'light';

function initialMode(): ColorMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * The app's color mode: an explicit choice if the user has made one, the OS
 * preference otherwise. Following the OS is a live subscription — a stored
 * choice opts out of it entirely rather than being overwritten by it.
 */
export function useColorMode(): readonly [ColorMode, () => void] {
  const [mode, setMode] = useState<ColorMode>(initialMode);
  const [explicit, setExplicit] = useState(() => localStorage.getItem(STORAGE_KEY) !== null);

  useEffect(() => {
    if (explicit) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e: MediaQueryListEvent) => setMode(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [explicit]);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next: ColorMode = m === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
    setExplicit(true);
  }, []);

  return [mode, toggle] as const;
}
