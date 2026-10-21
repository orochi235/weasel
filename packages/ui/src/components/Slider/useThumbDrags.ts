import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/core';
import { snapToStep } from '@weasel-js/quantity';
import { clamp } from '@weasel-js/geom';
import { DROP_OFF, type SliderGeometry } from './sliderGeometry';
import { clampOrdered, resolveBounds } from './stops';
import type { SliderProps, Thumb } from './types';
import type { useScale, useSpan } from './useSpan';
import { useLatestHandlers } from './useLatestHandlers';

/** A custom `ThumbShape.render` may put interactive content inside the thumb,
 *  and capture would retarget pointerup and kill the click on it. */
const NO_CAPTURE = { capture: false } as const;

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
  const { onInput, onChange } = useLatestHandlers(props);
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
      sessionRef.current?.cancel();
      const buf: T[] = (seed ?? thumbs).map(t => ({ ...t }));
      dragBufferRef.current = buf;
      setDragged(index);
      let droppedOff = false;

      const onMove = (ev: PointerEvent) => {
        const m = geometry.measure(ev.clientX, ev.clientY);
        const buffer = dragBufferRef.current;
        if (!m || !buffer) return;
        let v = valueAt(m.g, m.length);

        const [bLo, bHi] = resolveBounds(buffer[index], { thumbs: buffer, index }, min, max);
        v = clamp(v, bLo, bHi);

        if (constraint === 'ordered') v = clampOrdered(v, buffer, index, min, max, step);

        if (props.onRemoveThumb) droppedOff = m.across > DROP_OFF * m.thickness;

        buffer[index] = { ...buffer[index], value: v };
        onInput(buffer.map(t => ({ ...t })));
      };

      // A drag that ends without a release — cancelled pointer, lost capture,
      // an unmount — drops the buffer without committing.
      const onCancel = () => {
        sessionRef.current = null;
        dragBufferRef.current = null;
        setDragged(null);
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

        onChange(buffer.map(t => ({ ...t })));
      };

      sessionRef.current = openPointerSession(origin, down, { onMove, onEnd, onCancel }, NO_CAPTURE);
    },
    [thumbs, onInput, onChange, valueAt, min, max, step, constraint, props, geometry],
  );

  const beginShiftAllDrag = useCallback(
    (origin: Element, down: ReactPointerEvent, anchorG: number) => {
      sessionRef.current?.cancel();
      setDragged(null);
      const buf: T[] = thumbs.map(t => ({ ...t }));
      const startValues = buf.map(t => t.value);
      dragBufferRef.current = buf;

      const onMove = (ev: PointerEvent) => {
        const m = geometry.measure(ev.clientX, ev.clientY);
        const buffer = dragBufferRef.current;
        if (!m || !buffer) return;
        const dxFraction = m.gRaw - anchorG;
        // Evenly spaced gaps span different amounts of value, so equal value
        // offsets would pull the thumbs apart; move them by track distance.
        if (even) {
          const starts = startValues.map(valueToFraction);
          const df = clamp(dxFraction, -Math.min(...starts), 1 - Math.max(...starts));
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

      const onCancel = () => {
        sessionRef.current = null;
        dragBufferRef.current = null;
      };

      const onEnd = () => {
        sessionRef.current = null;
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        if (buffer) onChange(buffer.map(t => ({ ...t })));
      };

      sessionRef.current = openPointerSession(origin, down, { onMove, onEnd, onCancel }, NO_CAPTURE);
    },
    [thumbs, onInput, onChange, min, max, step, even, valueToFraction, fractionToValue, geometry],
  );

  return { beginThumbDrag, beginShiftAllDrag, dragged };
}
