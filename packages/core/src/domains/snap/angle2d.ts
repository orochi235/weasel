/** A snap session's one-dimensional path: an angle about a pivot, snapped by
 *  the same resolver as a point, with reach carried through the radius. */
import { wrapPositive } from '@weasel-js/geom';
import { resolveSnap, type SnapCandidate } from '@weasel-js/geom/nd';
import type { SnapMods } from 'interactions/actions/snapDep';
import { distinct, markFromPlane } from './marks';
import { screenOf } from './screen';
import { stepAngles } from './stepAngles';
import type { Session2dInputs } from './session2d';
import type { AngleCollect, SnapMark, SnapMarks, SnapSource } from './types';

const TURN = Math.PI * 2;
const PROBE = 'angle';
/** A press near the pivot turns px reach into a wide angle; it reaches no
 *  further than this. */
const MAX_REACH_RAD = Math.PI / 6;

/** Where `theta` lands, and what it met. Writes the marks to the store. */
export function angleAt(
  inputs: Session2dInputs, sources: readonly SnapSource[], theta: number, mods: SnapMods,
): { theta: number; marks: readonly SnapMark[] } {
  const { req, store } = inputs;
  // Screen px per radian, or 1 when the gesture gives its reach in radians.
  const scale = req.reachRad !== undefined ? 1 : pressRadiusPx(inputs);
  const reachOf = (s: SnapSource) => req.reachRad
    ?? Math.min(s.reachPx ?? inputs.reachPx, MAX_REACH_RAD * scale);
  const candidates = collectAngles(inputs, sources, theta, mods, reachOf);
  if (candidates.length === 0) {
    store.set([]);
    return { theta, marks: [] };
  }
  const res = resolveSnap({
    probes: [{ id: PROBE, at: [0], role: 'pointer' }],
    input: { at: [0], dirs: [[1]] },
    delta0: [theta],
    candidates,
    // No radius, no reach: only a required angle can win.
    toScreen: ([t]) => [scale > 0 ? t * scale : NaN],
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
  reachOf: (s: SnapSource) => number,
): SnapCandidate<SnapMarks>[] {
  const { req } = inputs;
  const out: SnapCandidate<SnapMarks>[] = [];
  const c = req.constrain;
  if (mods.constrain && typeof c === 'object' && c.step > 0) {
    for (const at of stepAngles(theta, c.step)) {
      out.push({ probe: PROBE, locus: { at: [at], dirs: [] }, source: 'constrain', order: -1, tier: 'target', reachPx: 0, required: true });
    }
  }
  const theta0 = req.theta0 ?? 0;
  if (mods.hold) {
    const at = theta0 + TURN * Math.round((theta - theta0) / TURN);
    out.push({ probe: PROBE, locus: { at: [at], dirs: [] }, source: 'hold', order: -1, tier: 'target', reachPx: 0, required: true, mark: [] });
  }
  if (mods.suspend) return out;
  const q: AngleCollect = {
    pivot: req.pivot ?? req.press,
    press: req.press,
    theta0,
    theta,
    ids: req.ids ?? [],
    exclude: inputs.exclude ?? req.ids ?? [],
    mods,
    ...(req.also ? { also: req.also } : {}),
    ...(inputs.scene ? { scene: inputs.scene } : {}),
    ...(inputs.rotationOf ? { rotationOf: inputs.rotationOf } : {}),
  };
  // Runs across sources and their yields: an earlier source, then an earlier
  // yield, wins a tie.
  let order = 0;
  sources.forEach((source) => {
    if (!source.angles) return;
    const reachPx = reachOf(source);
    for (const a of source.angles(q)) {
      // The whole turn of the angle nearest `theta`: 0 catches 359°.
      const at = a.angle + TURN * Math.round((theta - a.angle) / TURN);
      out.push({
        probe: PROBE, locus: { at: [at], dirs: [] }, source: source.id, order: order++, tier: source.tier ?? 'target', reachPx,
        ...(a.required ? { required: true } : {}),
        ...(a.mark ? { mark: a.mark } : {}),
      });
    }
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
  const deg = wrapPositive(Math.round(theta * 180 / Math.PI), 360);
  return [
    { kind: 'line', from: pivot, to: end },
    { kind: 'point', at: end, glyph: 'quadrant', label: `${deg}°` },
  ];
}
