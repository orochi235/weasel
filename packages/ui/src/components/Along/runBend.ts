import { clamp, runStationAt, type TrackRun } from '@weasel-js/geom';

/** Which way a run bends at `g`: `1` toward its items' up, `-1` away from it, `0` where it runs straight. */
export function bendAt(run: TrackRun, g: number): -1 | 0 | 1 {
  const a = clamp(g - 0.01, 0, 1);
  const b = clamp(g + 0.01, 0, 1);
  if (a === b) return 0;
  const pa = run.at(a).point;
  const pb = run.at(b).point;
  const { point: pm, normal } = run.at((a + b) / 2);
  const toward = ((pa.x + pb.x) / 2 - pm.x) * normal.x + ((pa.y + pb.y) / 2 - pm.y) * normal.y;
  if (Math.abs(toward) <= 1e-6 * Math.hypot(pb.x - pa.x, pb.y - pa.y)) return 0;
  return toward > 0 ? 1 : -1;
}

/** Which of its own sides an item drawn at `g` along `run` turns to the inside of the bend there, the half turn that
 *  keeps it upright counted: `'bottom'` where the run runs straight. */
export function insideOf(run: TrackRun, g: number): 'top' | 'bottom' {
  const bend = bendAt(run, g);
  return bend * (run.at(clamp(g, 0, 1)).turned ? -1 : 1) > 0 ? 'top' : 'bottom';
}

/** SVG path data for the stretch `from..to` px along `run`, moved `shift` px along its items' up: a polyline a point
 *  every 4 px or so, since a stretch moved off a curve is no longer the curve's own kind. */
export function runStretchD(run: TrackRun, from: number, to: number, shift = 0): string {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 4));
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const { point } = runStationAt(run, from + ((to - from) * i) / steps, shift, 'follow');
    parts.push(`${i === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`);
  }
  return parts.join(' ');
}

const round = (v: number): number => Math.round(v * 100) / 100;
