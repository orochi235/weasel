import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/routing';
import { DROP_OFF, type SliderGeometry } from './sliderGeometry';
import { draggedValue, shiftedValues } from './thumbDragValues';
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

  /** End the session, and hand back the buffer the drag left. */
  const release = useCallback((): T[] | null => {
    sessionRef.current = null;
    const buffer = dragBufferRef.current;
    dragBufferRef.current = null;
    return buffer;
  }, []);

  // `seed` replaces the thumb list the drag starts from. A track press moves a
  // thumb before the drag begins, and without seeding, a release with no
  // movement would commit the stale buffer and undo that move.
  const beginThumbDrag = useCallback(
    (origin: Element, down: ReactPointerEvent, index: number, seed?: readonly T[]) => {
      const start = copy(thumbs);
      dragBufferRef.current = copy(seed ?? thumbs);
      setDragged(index);
      let droppedOff = false;
      const bounds = { min, max, step, ordered: constraint === 'ordered' };

      const onMove = (ev: PointerEvent) => {
        const m = geometry.measure(ev.clientX, ev.clientY);
        const buffer = dragBufferRef.current;
        if (!m || !buffer) return;
        const v = draggedValue(buffer, index, valueAt(m.g, m.length, ev.altKey), bounds);
        if (props.onRemoveThumb) droppedOff = m.across > DROP_OFF * m.reach;
        buffer[index] = { ...buffer[index], value: v };
        onInput(copy(buffer));
      };

      const onCancel = () => {
        const buffer = release();
        setDragged(null);
        finish(buffer, start, false, handlers);
      };

      const onEnd = () => {
        const buffer = release();
        setDragged(null);
        if (!buffer) return;
        if (droppedOff && props.onRemoveThumb?.(index)) {
          const next = copy(buffer.filter((_, i) => i !== index));
          onInput(next);
          onChange(next);
          return;
        }
        finish(buffer, start, true, handlers);
      };

      sessionRef.current = openPointerSession(origin, down, { onMove, onEnd, onCancel }, NO_CAPTURE);
    },
    [thumbs, onInput, onChange, handlers, valueAt, min, max, step, constraint, props, geometry, release],
  );

  const beginShiftAllDrag = useCallback(
    (origin: Element, down: ReactPointerEvent, anchorG: number) => {
      setDragged(null);
      const start = copy(thumbs);
      const startValues = start.map(t => t.value);
      dragBufferRef.current = copy(thumbs);
      const shift = { byTrack: even || !!props.scale, valueToFraction, fractionToValue, min, max, step };

      const onMove = (ev: PointerEvent) => {
        const m = geometry.measure(ev.clientX, ev.clientY);
        const buffer = dragBufferRef.current;
        if (!m || !buffer) return;
        const values = shiftedValues(startValues, m.gRaw - anchorG, shift);
        for (let i = 0; i < buffer.length; i++) buffer[i] = { ...buffer[i], value: values[i] };
        onInput(copy(buffer));
      };

      const onCancel = () => finish(release(), start, false, handlers);
      const onEnd = () => finish(release(), start, true, handlers);

      sessionRef.current = openPointerSession(origin, down, { onMove, onEnd, onCancel }, NO_CAPTURE);
    },
    [thumbs, onInput, handlers, min, max, step, even, props.scale, valueToFraction, fractionToValue, geometry, release],
  );

  // `held`: a drag belongs to the finger that started it, so a second finger's press is not a new drag.
  return { beginThumbDrag, beginShiftAllDrag, dragged, held: () => sessionRef.current?.active === true, onInput, onChange };
}
