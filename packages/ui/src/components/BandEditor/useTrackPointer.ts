import type { RefObject } from 'react';
import { clamp01 } from '@weasel-js/geom';
import { attract } from '@weasel-js/ui-input';
import { useSnapRadiusPx } from '../../snap';
import { alongTrack } from '../../alongTrack';
import type { BandTick } from './BandRuler';

/**
 * Where a pointer sits along a band editor's track, in track units: clamped to the track for a split, or unclamped
 * and pulled onto a tick within the snap radius for an edge drag, `alt` defeating the pull.
 */
export function useTrackPointer(
  trackRef: RefObject<HTMLDivElement | null>, snap: boolean, ticks: BandTick[] | undefined, toUnit: (value: number) => number,
) {
  const snapRadiusPx = useSnapRadiusPx();
  const rawUnitAt = (clientX: number): number => alongTrack(trackRef.current, clientX)?.f ?? 0;
  const snapped = (unit: number, altKey: boolean): number => {
    if (!snap || altKey || !ticks || ticks.length === 0) return unit;
    const width = trackRef.current?.getBoundingClientRect().width ?? 0;
    return width === 0 ? unit : attract(unit, ticks.map((tick) => toUnit(tick.at)), snapRadiusPx / width);
  };
  return {
    snapRadiusPx,
    unitAt: (clientX: number): number => clamp01(rawUnitAt(clientX)),
    pointerUnit: (clientX: number, altKey: boolean): number => snapped(rawUnitAt(clientX), altKey),
  };
}
