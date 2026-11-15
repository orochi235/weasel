import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/core';
import { snapToStep } from '@weasel-js/quantity';
import { clamp, maxOf, minOf } from '@weasel-js/geom';
import { DROP_OFF, type SliderGeometry } from './sliderGeometry';
import { clampOrdered } from '@weasel-js/ui-input';
import { resolveBounds } from './stops';
import type { SliderProps, Thumb } from './types';
import type { useScale, useSpan } from './useSpan';
import { useLatestHandlers } from './useLatestHandlers';
import { sameThumbValues } from './tagged';

/** A custom `ThumbShape.render` may put interactive content inside the thumb,
 *  and capture would retarget pointerup and kill the click on it. */
const NO_CAPTURE = { capture: false, escape: true } as const;

const copy = <T extends Thumb>(thumbs: readonly T[]): T[] => thumbs.map(t => ({ ...t }));

type Handlers<T extends Thumb> = ReturnType<typeof useLatestHandlers<T>>;

/** End a drag that began at `start`: commit what it moved, or on a cancel put the preview back and say so. A drag
 *  that moved nothing does neither. */
function finish<T extends Thumb>(buffer: T[] | null, start: readonly T[], commit: boolean, h: Handlers<T>): void {
  if (!buffer || sameThumbValues(buffer, start)) return;
  if (commit) { h.onChange(copy(buffer)); return; }
  h.onInput(copy(start));
  h.onCancel();
}

/** What the drags read: the slider's props, the span and scale they run over, and the geometry they measure through. */
export interface ThumbDragArgs<T extends Thumb> {
  props: SliderProps<T>;
  span: ReturnType<typeof useSpan>;
  scale: ReturnType<typeof useScale>;
  geometry: SliderGeometry;
}

/** A slider's two pointer gestures: one thumb dragged along the rail, and every thumb moved together. */
export function useThumbDrags<T extends Thumb>({ props, span, scale, geometry }: ThumbDragArgs<T>) {
  const { thumbs, step, constraint } = props;
  const handlers = useLatestHandlers(props), { onInput, onChange } = handlers;
  const { even, min, max } = span;
  const { valueToFraction, fractionToValue, valueAt } = scale;
  // In-flight thumb buffer during a drag; null when not dragging.
  const dragBufferRef = useRef<T[] | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  // Which thumb a drag holds, for a thumb that draws itself differently while held.
  const [dragged, setDragged] = useState<number | null>(null);

  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  // `seed` replaces the thumb list the drag starts from. A track press moves a
  // thumb before the drag begins, and without seeding, a release with no
  // movement would commit the stale buffer and undo that move.
  const beginThumbDrag = useCallback(
    (origin: Element, down: ReactPointerEvent, index: number, seed?: readonly T[]) => {
      const start = copy(thumbs), buf: T[] = copy(seed ?? thumbs);
      dragBufferRef.current = buf;
      setDragged(index);
      let droppedOff = false;

      const onMove = (ev: PointerEvent) => {
        const m = geometry.measure(ev.clientX, ev.clientY);
        const buffer = dragBufferRef.current;
        if (!m || !buffer) return;
        let v = valueAt(m.g, m.length, ev.altKey);

        const [bLo, bHi] = resolveBounds(buffer[index], { thumbs: buffer, index }, min, max);
        v = clamp(v, bLo, bHi);

        if (constraint === 'ordered') v = clampOrdered(v, buffer, index, bLo, bHi, step);

        if (props.onRemoveThumb) droppedOff = m.across > DROP_OFF * m.reach;

        buffer[index] = { ...buffer[index], value: v };
        onInput(buffer.map(t => ({ ...t })));
      };

      const onCancel = () => {
        sessionRef.current = null;
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        setDragged(null);
        finish(buffer, start, false, handlers);
      };

      const onEnd = () => {
        sessionRef.current = null;
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        setDragged(null);
        if (!buffer) return;

        if (droppedOff && props.onRemoveThumb) {
          const accepted = props.onRemoveThumb(index);
          if (accepted) {
            const next = buffer.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
            onInput(next);
            onChange(next);
            return;
          }
        }

        finish(buffer, start, true, handlers);
      };

      sessionRef.current = openPointerSession(origin, down, { onMove, onEnd, onCancel }, NO_CAPTURE);
    },
    [thumbs, onInput, onChange, handlers, valueAt, min, max, step, constraint, props, geometry],
  );

  const beginShiftAllDrag = useCallback(
    (origin: Element, down: ReactPointerEvent, anchorG: number) => {
      setDragged(null);
      const start = copy(thumbs), buf: T[] = copy(thumbs);
      const startValues = buf.map(t => t.value);
      dragBufferRef.current = buf;

      const onMove = (ev: PointerEvent) => {
        const m = geometry.measure(ev.clientX, ev.clientY);
        const buffer = dragBufferRef.current;
        if (!m || !buffer) return;
        const dxFraction = m.gRaw - anchorG;
        // Evenly spaced gaps, or a scale, span different amounts of value, so
        // equal value offsets would pull the thumbs apart; move them by track distance.
        if (even || props.scale) {
          const starts = startValues.map(valueToFraction);
          const df = clamp(dxFraction, -minOf(starts), 1 - maxOf(starts));
          for (let i = 0; i < buffer.length; i++) {
            buffer[i] = { ...buffer[i], value: fractionToValue(starts[i] + df) };
          }
          onInput(buffer.map(t => ({ ...t })));
          return;
        }
        let dValue = dxFraction * (max - min);
        dValue = snapToStep(dValue, step, 0);

        // Clamp delta so no thumb leaves [min, max] (per-thumb bounds intentionally
        // not enforced — matches the experiment's hue-band shift-translate semantics).
        let allowedNeg = -Infinity;
        let allowedPos = Infinity;
        for (let i = 0; i < startValues.length; i++) {
          allowedNeg = Math.max(allowedNeg, min - startValues[i]);
          allowedPos = Math.min(allowedPos, max - startValues[i]);
        }
        dValue = clamp(dValue, allowedNeg, allowedPos);

        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = { ...buffer[i], value: clamp(startValues[i] + dValue, min, max) };
        }
        onInput(buffer.map(t => ({ ...t })));
      };

      const settle = (commit: boolean) => {
        sessionRef.current = null;
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        finish(buffer, start, commit, handlers);
      };
      const onCancel = () => settle(false);
      const onEnd = () => settle(true);

      sessionRef.current = openPointerSession(origin, down, { onMove, onEnd, onCancel }, NO_CAPTURE);
    },
    [thumbs, onInput, handlers, min, max, step, even, props.scale, valueToFraction, fractionToValue, geometry],
  );

  // `held`: a drag belongs to the finger that started it, so a second finger's press is not a new drag.
  return { beginThumbDrag, beginShiftAllDrag, dragged, held: () => sessionRef.current?.active === true, onInput, onChange };
}
