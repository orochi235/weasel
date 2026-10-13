import { useCallback } from 'react';
import { useLatest } from '@weasel-js/core';
import type { SliderProps, Thumb } from './types';

/**
 * `onInput` and `onChange` as stable functions that call whichever handlers the
 * latest render passed. A drag outlives the render it began in, and a caller's
 * handler closes over that render's state.
 */
export function useLatestHandlers<T extends Thumb>(props: Pick<SliderProps<T>, 'onInput' | 'onChange'>) {
  const latest = useLatest({ onInput: props.onInput, onChange: props.onChange });
  const onInput = useCallback((next: T[]) => latest.current.onInput(next), [latest]);
  const onChange = useCallback((next: T[]) => latest.current.onChange?.(next), [latest]);
  return { onInput, onChange };
}
