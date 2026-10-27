/**
 * The bands text along a path carries — decoration rules cut into clusters — joined across neighboring items and drawn
 * as ribbons that bend with the path.
 */
import { polygonFromPoints, runStationAt, type Point, type TrackRun } from '@weasel-js/geom';
import type { DerivedPart } from '../derivedParts';
import type { EffectBand, EffectItem } from './source';

/** One kept item as the band walk reads it: where its leading edge falls along the run, and its anchor line's lift. */
export interface LaidItem {
  item: EffectItem;
  /** Its leading edge, along the run in reading order, unwrapped. */
  start: number;
  lift: number;
}

interface Ribbon {
  band: EffectBand;
  /** Its edges against the path's anchor line, y down. */
  y0: number;
  y1: number;
  from: number;
  to: number;
  /** Whether it reaches the end of the item it was last carried through. */
  open: boolean;
}

// Samples per path length, so a ribbon's chords stay as close to the path as the path's own flattening.
const PER_PATH = 512;
const MAX_SAMPLES = 2048;

/** Every ribbon `laid` carries, `shift` off the run. A `null` in `laid` is a dropped item, which no ribbon crosses. */
export function bandParts(laid: readonly (LaidItem | null)[], run: TrackRun, shift: number): DerivedPart[] {
  const out: DerivedPart[] = [];
  let live: Ribbon[] = [];
  const hair = 1e-9 * Math.max(1, run.length);
  for (const at of laid) {
    const next: Ribbon[] = [];
    for (const band of at?.item.bands ?? []) {
      if (!(band.x1 > band.x0)) continue;
      const y0 = band.y0 + at!.lift;
      const y1 = band.y1 + at!.lift;
      const k = band.x0 <= hair ? live.findIndex((r) => r.open && alike(r, band, y0, y1)) : -1;
      const ribbon = k < 0 ? { band, y0, y1, from: at!.start + band.x0, to: 0, open: false } : live.splice(k, 1)[0]!;
      ribbon.to = at!.start + band.x1;
      ribbon.open = band.x1 >= at!.item.length - hair;
      next.push(ribbon);
    }
    for (const r of live) out.push(ribbonPart(r, run, shift));
    live = next;
  }
  for (const r of live) out.push(ribbonPart(r, run, shift));
  return out;
}

const alike = (r: Ribbon, band: EffectBand, y0: number, y1: number): boolean =>
  r.y0 === y0 && r.y1 === y1 && r.band.fill === band.fill && r.band.stroke === band.stroke;

function ribbonPart(r: Ribbon, run: TrackRun, shift: number): DerivedPart {
  const L = run.length;
  const n = Math.min(MAX_SAMPLES, Math.max(1, Math.ceil(((r.to - r.from) * PER_PATH) / L)));
  const top: Point[] = [];
  const bottom: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const d = r.from + ((r.to - r.from) * i) / n;
    const { point, normal } = runStationAt(run, run.closed ? ((d % L) + L) % L : d);
    const up = (y: number): Point => ({ x: point.x + (shift - y) * normal.x, y: point.y + (shift - y) * normal.y });
    top.push(up(r.y0));
    bottom.push(up(r.y1));
  }
  return { path: polygonFromPoints([...top, ...bottom.reverse()]), fill: r.band.fill, stroke: r.band.stroke };
}
