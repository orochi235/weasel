import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { sliderKey } from '@weasel-js/headless';
import { resolveBounds } from './stops';
import type { SliderProps, Thumb } from './types';

/** What a key press reads: the thumbs, the span, and the props that steer a keystroke. */
export interface ThumbKeyArgs<T extends Thumb> {
  thumbs: readonly T[];
  stops: number[];
  min: number;
  max: number;
  step: number | undefined;
  constraint: SliderProps<T>['constraint'];
  keyStep: SliderProps<T>['keyStep'];
  /** The finite range, where the track runs past it to an endless end's stop. */
  range: readonly [number, number] | undefined;
  onInput: (next: T[]) => void;
  onChange: ((next: T[]) => void) | undefined;
  /** Under `'rtl'` the horizontal arrows are mirrored, as the values run from the right end. */
  direction: 'ltr' | 'rtl';
}

/** The keydown handler for thumb `index`: arrows, page keys, Home and End move its value. */
export function onThumbKeyDown<T extends Thumb>(a: ThumbKeyArgs<T>) {
  const { thumbs, min, max, keyStep } = a;
  return (index: number) => (e: ReactKeyboardEvent) => {
    const next = thumbs.map(t => ({ ...t }));
    const v = sliderKey(e.key, e.shiftKey, {
      thumbs: next,
      index,
      min,
      max,
      step: a.step,
      stops: a.stops,
      ordered: a.constraint === 'ordered',
      range: a.range,
      dir: a.direction,
      bounds: () => resolveBounds(next[index], { thumbs: next, index }, min, max),
      keyStep: keyStep && (steps => keyStep(next[index], steps, index)),
    });
    if (v === null) return;
    e.preventDefault();
    next[index] = { ...next[index], value: v };
    a.onInput(next);
    a.onChange?.(next);
  };
}
