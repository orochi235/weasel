import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { clamp } from '@weasel-js/geom';
import type { SliderGeometry } from './sliderGeometry';
import { clampOrdered } from '@weasel-js/headless';
import { resolveBounds } from './stops';
import type { SliderProps, Thumb } from './types';
import type { useThumbDrags } from './useThumbDrags';

/** A thumb, picked by its role: its class composes another, so `.${s.thumb}` names two classes and matches nothing. */
const THUMB = '[role="slider"]';

/** What the presses read: the thumbs and the props that steer them, the geometry and scale that turn a pointer into a value, and the drags they hand off to. */
export interface SliderPointerArgs<T extends Thumb> {
  thumbs: readonly T[];
  props: Pick<SliderProps<T>, 'trackClick' | 'onAddThumb' | 'onRemoveThumb' | 'allowShiftAll' | 'onChange' | 'constraint' | 'step' | 'regionDrag'>;
  min: number;
  max: number;
  trackRef: RefObject<HTMLDivElement | null>;
  geometry: SliderGeometry;
  valueAt: (f: number, length: number, free?: boolean) => number;
  onInput: (next: T[]) => void;
  drags: Pick<ReturnType<typeof useThumbDrags<T>>, 'beginThumbDrag' | 'beginShiftAllDrag'>;
}

/** The presses on a slider: a thumb, a thumb's context menu, and the bare track. */
export function useSliderPointer<T extends Thumb>(a: SliderPointerArgs<T>) {
  const { thumbs, props, min, max, trackRef, geometry, valueAt, onInput, drags } = a;
  const { onChange, constraint, step } = props;

  const onThumbPointerDown = (index: number) => (e: ReactPointerEvent) => {
    // Only bail on explicit non-primary buttons (button > 0). jsdom's PointerEvent
    // leaves `button` undefined; treat that as primary so tests can drive drags.
    if (typeof e.button === 'number' && e.button > 0) return;
    // preventDefault below suppresses the focus the press would otherwise
    // give the thumb, and the arrow keys are on the thumb.
    (e.currentTarget as HTMLElement).focus?.();
    e.preventDefault();
    e.stopPropagation();
    const origin = e.currentTarget as HTMLElement;
    const anchor = e.shiftKey && props.allowShiftAll ? geometry.measure(e.clientX, e.clientY) : null;
    if (anchor) drags.beginShiftAllDrag(origin, e, anchor.gRaw);
    else drags.beginThumbDrag(origin, e, index);
  };

  const onThumbContextMenu = (index: number) => (e: ReactMouseEvent) => {
    if (!props.onRemoveThumb) return;
    e.preventDefault();
    const accepted = props.onRemoveThumb(index);
    if (!accepted) return;
    const next = thumbs.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
    onInput(next);
    onChange?.(next);
  };

  const onTrackPointerDown = (e: ReactPointerEvent<Element>) => {
    if (typeof e.button === 'number' && e.button > 0) return;
    const trackClick = props.trackClick ?? (thumbs.length === 1 ? 'move-nearest' : 'none');
    const wantsMove = trackClick === 'move-nearest' && thumbs.length > 0;
    if (!props.onAddThumb && !wantsMove) return;
    // If the event originated on a thumb, the thumb's own handler ran first; this is a track click.
    if ((e.target as Element).closest(THUMB)) return;
    if (props.regionDrag && (e.target as Element).closest('[data-slider-region]')) return;
    e.preventDefault();
    const track = trackRef.current;
    const m = geometry.measure(e.clientX, e.clientY);
    if (!track || !m) return;
    const v = valueAt(m.g, m.length, e.altKey);

    if (props.onAddThumb) {
      const created = props.onAddThumb(v);
      if (!created) return;
      const next = [...thumbs.map(t => ({ ...t })), created] as T[];
      onInput(next);
      onChange?.(next);
      return;
    }

    let index = 0;
    for (let i = 1; i < thumbs.length; i++) {
      if (Math.abs(thumbs[i].value - v) < Math.abs(thumbs[index].value - v)) index = i;
    }
    const next = thumbs.map(t => ({ ...t })) as T[];
    const [bLo, bHi] = resolveBounds(next[index], { thumbs: next, index }, min, max);
    let moved = clamp(v, bLo, bHi);
    if (constraint === 'ordered') moved = clampOrdered(moved, next, index, min, max, step);
    next[index] = { ...next[index], value: moved };
    onInput(next);
    // preventDefault above suppresses the focus the press would give; the arrow keys are on the thumb.
    track.querySelectorAll<HTMLElement>(THUMB)[index]?.focus();
    drags.beginThumbDrag(track, e, index, next);
  };

  return { onThumbPointerDown, onThumbContextMenu, onTrackPointerDown };
}
