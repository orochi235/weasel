/** A snap session's one-dimensional path: an angle about a pivot, snapped by
 *  the same resolver as a point, with reach carried through the radius. */
import { resolveSnap, type SnapCandidate } from '@weasel-js/geom/nd';
import type { SnapMods } from 'interactions/actions/snapDep';
import { distinct, markFromPlane } from './marks';
import { screenOf } from './screen';
import type { Session2dInputs } from './session2d';
import type { AngleCollect, SnapMark, SnapMarks, SnapSource } from './types';

const TURN = Math.PI * 2;
const PROBE = 'angle';

/** Where `theta` lands, and what it met. Writes the marks to the store. */
export function angleAt(
  inputs: Session2dInputs, sources: readonly SnapSource[], theta: number, mods: SnapMods,
): { theta: number; marks: readonly SnapMark[] } {
  const { req, store } = inputs;
  const candidates = collectAngles(inputs, sources, theta, mods);
  if (candidates.length === 0) {
    store.set([]);
    return { theta, marks: [] };
  }
  const radiusPx = pressRadiusPx(inputs);
  const res = resolveSnap({
    probes: [{ id: PROBE, at: [0], role: 'pointer' }],
    input: { at: [0], dirs: [[1]] },
    delta0: [theta],
    candidates,
    // No radius, no reach: only a required angle can win.
    toScreen: ([t]) => [radiusPx > 0 ? t * radiusPx : NaN],
  });
  const out = res.delta[0];
  const marks = distinct(res.satisfied.flatMap((c) => {
    const m = c.mark ?? rayMarks(inputs, out);
    return 'kind' in m ? [m] : m;
  }));
  const plane = req.plane?.() ?? null;
  store.set(plane ? marks.map((m) => markFromPlane(m, plane)) : marks);
  return { theta: out, marks };
}

function collectAngles(
  inputs: Session2dInputs, sources: readonly SnapSource[], theta: number, mods: SnapMods,
): SnapCandidate<SnapMarks>[] {
  const { req } = inputs;
  const out: SnapCandidate<SnapMarks>[] = [];
  const add = (angle: number, source: string, order: number, reachPx: number, required: boolean, tier: SnapSource['tier'], mark?: SnapMarks) => {
    // The whole turn of `angle` nearest `theta`: 0 catches 359°.
    const at = angle + TURN * Math.round((theta - angle) / TURN);
    out.push({
      probe: PROBE, locus: { at: [at], dirs: [] }, source, order, tier: tier ?? 'target', reachPx,
      ...(required ? { required: true } : {}),
      ...(mark ? { mark } : {}),
    });
  };
  const c = req.constrain;
  if (mods.constrain && typeof c === 'object' && c.step > 0) {
    const n = Math.round(TURN / c.step);
    for (let k = 0; k < n; k++) add(k * c.step, 'constrain', -1, 0, true, 'target');
  }
  if (mods.suspend) return out;
  const q: AngleCollect = {
    pivot: req.pivot ?? req.press,
    theta0: req.theta0 ?? 0,
    theta,
    ids: req.ids ?? [],
    exclude: inputs.exclude ?? req.ids ?? [],
    mods,
    ...(inputs.scene ? { scene: inputs.scene } : {}),
    ...(inputs.rotationOf ? { rotationOf: inputs.rotationOf } : {}),
  };
  sources.forEach((source, order) => {
    if (!source.angles) return;
    const reach = source.reachPx ?? inputs.reachPx;
    for (const a of source.angles(q)) add(a.angle, source.id, order, reach, a.required === true, source.tier, a.mark);
  });
  return out;
}

/** The screen distance from the pivot to the press: what turns reach in px
 *  into radians. */
function pressRadiusPx(inputs: Session2dInputs): number {
  const { req } = inputs;
  const pivot = req.pivot ?? req.press;
  const toScreen = screenOf(inputs.view(), req.plane?.() ?? null);
  const [ax, ay] = toScreen([pivot.x, pivot.y]);
  const [bx, by] = toScreen([req.press.x, req.press.y]);
  return Math.hypot(bx - ax, by - ay);
}

/** A ray from the pivot out to the press radius, along where the pointer
 *  lands at `theta`, labeled with `theta` in degrees. */
function rayMarks(inputs: Session2dInputs, theta: number): SnapMark[] {
  const { req } = inputs;
  const pivot = req.pivot ?? req.press;
  const r = Math.hypot(req.press.x - pivot.x, req.press.y - pivot.y);
  const dir = Math.atan2(req.press.y - pivot.y, req.press.x - pivot.x) + theta - (req.theta0 ?? 0);
  const end = { x: pivot.x + r * Math.cos(dir), y: pivot.y + r * Math.sin(dir) };
  const deg = ((Math.round(theta * 180 / Math.PI) % 360) + 360) % 360;
  return [
    { kind: 'line', from: pivot, to: end },
    { kind: 'point', at: end, glyph: 'quadrant', label: `${deg}°` },
  ];
}
