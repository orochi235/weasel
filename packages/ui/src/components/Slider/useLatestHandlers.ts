import { useCallback } from 'react';
import { useLatest } from '@weasel-js/core';
import type { SliderProps, Thumb } from './types';

/**
 * `onInput`, `onChange` and `onCancel` as stable functions that call whichever handlers the
 * latest render passed. A drag outlives the render it began in, and a caller's
 * handler closes over that render's state.
 */
export function useLatestHandlers<T extends Thumb>(props: Pick<SliderProps<T>, 'onInput' | 'onChange' | 'onCancel'>) {
  const latest = useLatest({ onInput: props.onInput, onChange: props.onChange, onCancel: props.onCancel });
  const onInput = useCallback((next: T[]) => latest.current.onInput(next), [latest]);
  const onChange = useCallback((next: T[]) => latest.current.onChange?.(next), [latest]);
  const onCancel = useCallback(() => latest.current.onCancel?.(), [latest]);
  return { onInput, onChange, onCancel };
}
