import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { openPointerSession, pastDragThreshold, type PointerSession } from '@weasel-js/core';
import { clamp } from '@weasel-js/geom';
import type { SliderGeometry } from './sliderGeometry';
import { resolveBounds } from './stops';
import type { SliderProps, Thumb } from './types';
import type { useScale } from './useSpan';
import { useLatestHandlers } from './useLatestHandlers';

/** What a region drag reads: the thumbs and their handlers, the span, and the map and geometry a pointer goes through. */
export interface RegionDragArgs<T extends Thumb> {
  props: Pick<SliderProps<T>, 'thumbs' | 'onInput' | 'onChange' | 'onCancel'>;
  min: number;
  max: number;
  scale: Pick<ReturnType<typeof useScale>, 'valueToFraction' | 'fractionToValue'>;
  geometry: SliderGeometry;
}

/** How far, as a fraction of the track, the two thumbs bounding region `index` can travel together. */
function regionReach<T extends Thumb>(thumbs: readonly T[], index: number, f: readonly number[], toFraction: (v: number) => number, min: number, max: number): [number, number] {
  const [a, b] = [index - 1, index];
  const [aLo, aHi] = resolveBounds(thumbs[a], { thumbs, index: a }, min, max).map(toFraction);
  const [bLo, bHi] = resolveBounds(thumbs[b], { thumbs, index: b }, min, max).map(toFraction);
  const below = index >= 2 ? f[index - 2] : 0;
  const above = index + 1 < thumbs.length ? f[index + 1] : 1;
  return [
    Math.max(below - f[a], aLo - f[a], bLo - f[b]),
    Math.min(above - f[b], aHi - f[a], bHi - f[b]),
  ];
}

/** The press handler for region `index`: dragged, it moves the thumbs either side of it by the same track distance. An
 *  end region has a track end for one side, and does not move. */
export function useRegionDrag<T extends Thumb>({ props, min, max, scale, geometry }: RegionDragArgs<T>) {
  const { onInput, onChange, onCancel } = useLatestHandlers(props);
  const { valueToFraction, fractionToValue } = scale;
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  return (index: number) => (e: ReactPointerEvent) => {
    if (typeof e.button === 'number' && e.button > 0) return;
    const { thumbs } = props;
    if (index === 0 || index >= thumbs.length) return;
    const start = geometry.measure(e.clientX, e.clientY);
    if (!start) return;
    const f = thumbs.map(t => valueToFraction(t.value));
    const [lo, hi] = regionReach(thumbs, index, f, valueToFraction, min, max);
    const press = { clientX: e.clientX, clientY: e.clientY };
    let latest: T[] | null = null;
    const moved = (shift: number): T[] => thumbs.map((t, i) =>
      (shift !== 0 && (i === index - 1 || i === index) ? { ...t, value: fractionToValue(f[i] + shift) } : { ...t }));

    sessionRef.current?.cancel();
    // No capture: a region draws content of its own, and capture would retarget pointerup and kill the click on it.
    sessionRef.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => {
        if (!latest && !pastDragThreshold(press, ev)) return;
        const m = geometry.measure(ev.clientX, ev.clientY);
        if (!m) return;
        latest = moved(clamp(m.gRaw - start.gRaw, lo, hi));
        onInput(latest);
      },
      onEnd: () => {
        sessionRef.current = null;
        if (latest) onChange(latest);
      },
      onCancel: () => {
        sessionRef.current = null;
        if (latest) onCancel();
      },
    }, { capture: false });
  };
}
