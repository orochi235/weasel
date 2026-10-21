import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { clamp } from '@weasel-js/geom';
import { snapToStep } from '@weasel-js/quantity';
import { crossEnd } from './crossEnd';
import { keyMoveOf } from './keyMove';
import { clampOrdered, defaultStep, resolveBounds, stepStops } from './stops';
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
}

/** The keydown handler for thumb `index`: arrows, page keys, Home and End move its value. */
export function onThumbKeyDown<T extends Thumb>(a: ThumbKeyArgs<T>) {
  const { thumbs, stops, min, max, step, constraint } = a;
  return (index: number) => (e: ReactKeyboardEvent) => {
    const move = keyMoveOf(e);
    if (!move) return;
    const range = a.range ?? [min, max];
    const stepSize = defaultStep(step, range[0], range[1]);
    e.preventDefault();
    const next = thumbs.map(t => ({ ...t }));
    const [bLo, bHi] = resolveBounds(next[index], { thumbs: next, index }, min, max);
    const lo = Math.max(min, bLo);
    const hi = Math.min(max, bHi);
    let v: number;
    if (move === 'home') v = lo;
    else if (move === 'end') v = hi;
    else if (a.keyStep) v = a.keyStep(next[index], move, index);
    // With stops, a keystroke moves by whole stops rather than by value.
    else if (stops.length > 0) v = stepStops(stops, next[index].value, move > 0 ? 1 : -1, Math.abs(move));
    else {
      const delta = move * stepSize;
      v = crossEnd(next[index].value, delta, stepSize, range, [min, max]) ?? snapToStep(next[index].value + delta, step, min);
    }
    v = clamp(v, lo, hi);
    if (constraint === 'ordered') v = clampOrdered(v, next, index, lo, hi, step);
    next[index] = { ...next[index], value: v };
    a.onInput(next);
    a.onChange?.(next);
  };
}
