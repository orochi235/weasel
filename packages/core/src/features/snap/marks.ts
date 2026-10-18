import { fromPlane, type PlaneMap } from 'core/viewport/parallax';
import type { SnapMark } from './types';

type Point = { x: number; y: number };

/** `marks` with repeats dropped, so a target several probes meet is drawn once. */
export function distinct(marks: readonly SnapMark[]): SnapMark[] {
  const seen = new Set<string>();
  return marks.filter((m) => {
    const key = JSON.stringify(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** `m` carried out of a plane into the camera's world, where the readout draws. */
export function markFromPlane(m: SnapMark, plane: PlaneMap): SnapMark {
  const pt = (p: Point) => fromPlane(plane, p);
  return m.kind === 'point' ? { ...m, at: pt(m.at) } : { ...m, from: pt(m.from), to: pt(m.to) };
}
