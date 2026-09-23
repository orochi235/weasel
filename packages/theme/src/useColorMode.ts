import { useCallback, useEffect, useState } from 'react';
import { isColorModePreference, type ColorMode, type ColorModePreference } from './colorMode';

function systemQuery(): MediaQueryList | null {
  if (typeof globalThis.matchMedia !== 'function') return null;
  return globalThis.matchMedia('(prefers-color-scheme: light)');
}

const systemMode = (): ColorMode => (systemQuery()?.matches ? 'light' : 'dark');

/**
 * Resolves a preference to the mode a `ThemeProvider` selection takes.
 * `'auto'` subscribes to the OS setting and follows it live; an explicit
 * choice opts out of the subscription entirely.
 */
export function useResolvedColorMode(preference: ColorModePreference): ColorMode {
  const [system, setSystem] = useState<ColorMode>(systemMode);

  useEffect(() => {
    if (preference !== 'auto') return;
    const mq = systemQuery();
    if (!mq) return;
    setSystem(mq.matches ? 'light' : 'dark');
    const onChange = (e: { matches: boolean }) => setSystem(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  return preference === 'auto' ? system : preference;
}

/** The part of `Storage` {@link useColorModePreference} reads and writes. */
export type ColorModeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Options for {@link useColorModePreference}. */
export interface ColorModePreferenceOptions {
  /** Where the choice is remembered. Unset, it lasts as long as the component. */
  readonly storageKey?: string;
  /** The store `storageKey` names a slot in. Defaults to `localStorage`. */
  readonly storage?: ColorModeStorage;
  /** The preference before the user has chosen one. Defaults to `'auto'`. */
  readonly defaultPreference?: ColorModePreference;
}

/** What {@link useColorModePreference} returns. */
export interface ColorModePreferenceState {
  readonly preference: ColorModePreference;
  readonly setPreference: (next: ColorModePreference) => void;
  /** `preference` resolved against the OS — what to put in the theme's `mode` axis. */
  readonly mode: ColorMode;
}

function defaultStorage(): ColorModeStorage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * A user's color-mode choice, optionally remembered across loads, and the mode
 * it resolves to. Storage that is missing or throws (a private window, blocked
 * site data) degrades to an unremembered choice rather than an error.
 */
export function useColorModePreference(
  options: ColorModePreferenceOptions = {},
): ColorModePreferenceState {
  const { storageKey, storage, defaultPreference = 'auto' } = options;

  const [preference, setState] = useState<ColorModePreference>(() => {
    if (storageKey === undefined) return defaultPreference;
    try {
      const stored = (storage ?? defaultStorage())?.getItem(storageKey);
      return isColorModePreference(stored) ? stored : defaultPreference;
    } catch {
      return defaultPreference;
    }
  });

  const setPreference = useCallback(
    (next: ColorModePreference) => {
      setState(next);
      if (storageKey === undefined) return;
      try {
        (storage ?? defaultStorage())?.setItem(storageKey, next);
      } catch {
        // Unremembered, but still applied.
      }
    },
    [storageKey, storage],
  );

  return { preference, setPreference, mode: useResolvedColorMode(preference) };
}
