import { useSyncExternalStore } from 'react';
import type { KeyModifiers } from './keyState';
import { useKeyState, type UseKeyStateOptions } from './useKeyState';

/**
 * Which modifier keys are held, re-rendering the component when that changes.
 * For chrome that draws the modifiers; a frame loop polls
 * {@link useKeyState} instead. The object is the same one between changes.
 */
export function useKeyModifiers(options: UseKeyStateOptions = {}): KeyModifiers {
  const keys = useKeyState(options);
  return useSyncExternalStore(keys.subscribe, keys.modifiers, keys.modifiers);
}
