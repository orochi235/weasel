import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/routing';
import { useKitSetting } from '@weasel-js/react';
import { clamp } from '@weasel-js/geom';
import type { SliderGeometry } from './sliderGeometry';
import { resolveBounds } from './stops';
import type { SliderProps, Thumb } from './types';
import type { useScale } from './useSpan';
import { useLatestHandlers } from './useLatestHandlers';
import { isPrimaryPress, pastDragThreshold } from '@weasel-js/gestures';
import { sameThumbValues } from './tagged';
import { stopShifted } from './thumbDragValues';
import { snapToStep } from '@weasel-js/quantity';

/** What a region drag reads: the thumbs and their handlers, the span, and the map and geometry a pointer goes through. */
export interface RegionDragArgs<T extends Thumb> {
  props: Pick<SliderProps<T>, 'thumbs' | 'onInput' | 'onChange' | 'onCancel'>;
  min: number;
  max: number;
  scale: Pick<ReturnType<typeof useScale>, 'valueToFraction' | 'fractionToValue' | 'snap'>;
  geometry: SliderGeometry;
  /** Whether another of the slider's drags holds it, so a press here is a second finger and starts nothing. */
  busy: () => boolean;
}

/** How far, as a fraction of the track, the two thumbs bounding region `index` can travel together. */
function regionReach<T extends Thumb>(thumbs: readonly T[], index: number, f: readonly number[], toFraction: (v: number) => number, min: number, max: number): [number, number] {
  const [a, b] = [index - 1, index];
  // Each thumb's bounds are read with its partner left out: the two move together, so neither stops the other.
  const without = (i: number) => thumbs.filter((_, j) => j !== i);
  const [aLo, aHi] = resolveBounds(thumbs[a], { thumbs: without(b), index: a }, min, max).map(toFraction);
  const [bLo, bHi] = resolveBounds(thumbs[b], { thumbs: without(a), index: a }, min, max).map(toFraction);
  const below = index >= 2 ? f[index - 2] : 0;
  const above = index + 1 < thumbs.length ? f[index + 1] : 1;
  return [
    Math.max(below - f[a], aLo - f[a], bLo - f[b]),
    Math.min(above - f[b], aHi - f[a], bHi - f[b]),
  ];
}

/** The press handler for region `index`: dragged, it moves the thumbs either side of it by the same track distance. An
 *  end region has a track end for one side, and does not move. `held` says whether a region drag is running. */
export function useRegionDrag<T extends Thumb>({ props, min, max, scale, geometry, busy }: RegionDragArgs<T>) {
  const { onInput, onChange, onCancel } = useLatestHandlers(props);
  const { valueToFraction, fractionToValue, snap } = scale;
  const dragPx = useKitSetting('gestures.dragPx');
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  const held = (): boolean => sessionRef.current?.active === true;
  const down = (index: number) => (e: ReactPointerEvent) => {
    if (!isPrimaryPress(e) || held() || busy()) return;
    const { thumbs } = props;
    if (index === 0 || index >= thumbs.length) return;
    const start = geometry.measure(e.clientX, e.clientY);
    if (!start) return;
    const f = thumbs.map(t => valueToFraction(t.value));
    const [lo, hi] = regionReach(thumbs, index, f, valueToFraction, min, max);
    const press = { clientX: e.clientX, clientY: e.clientY };
    let latest: T[] | null = null;
    const pair = [index - 1, index] as const;
    // Each of the two lands where a dragged thumb could, held inside the reach they share.
    const placed = (at: number): number[] => {
      if (snap.strict) {
        const fits = (vs: readonly number[]) => vs.every((v, j) => { const d = valueToFraction(v) - f[pair[j]!]; return d >= lo - 1e-9 && d <= hi + 1e-9; });
        return stopShifted(pair.map(i => thumbs[i].value), start.gRaw, at, snap.stops, valueToFraction, fits);
      }
      const shift = clamp(at - start.gRaw, lo, hi);
      if (shift === 0) return pair.map(i => thumbs[i].value);
      return pair.map(i => clamp(snapToStep(fractionToValue(f[i] + shift), snap.step, snap.origin), fractionToValue(f[i] + lo), fractionToValue(f[i] + hi)));
    };
    const moved = (at: number | null): T[] => {
      const values = at === null ? null : placed(at);
      return thumbs.map((t, i) => (values && (i === pair[0] || i === pair[1]) ? { ...t, value: values[i - pair[0]]! } : { ...t }));
    };

    // No capture: a region draws content of its own, and capture would retarget pointerup and kill the click on it.
    sessionRef.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => {
        if (!latest && !pastDragThreshold(press, ev, dragPx)) return;
        const m = geometry.measure(ev.clientX, ev.clientY);
        if (!m) return;
        latest = moved(m.gRaw);
        onInput(latest);
      },
      onEnd: () => {
        sessionRef.current = null;
        if (latest && !sameThumbValues(latest, thumbs)) onChange(latest);
      },
      onCancel: () => {
        sessionRef.current = null;
        if (!latest) return;
        onInput(moved(null));
        onCancel();
      },
    }, { capture: false, escape: true });
  };
  return { down, held };
}
