import { gatherSnapCandidates, resolveHolding, resolvedSnapMarks, snapSourcesFor, type GatheredCandidate, type SnapBegin, type SnapOutcome, type SnapOutcomeStore, type SnapProbeAt, type SnapSession, type SnapSource } from '@weasel-js/core/engine';
import { closestOnFlat, resolveSnap, type Flat } from '@weasel-js/geom/nd';
import {
  add, cross, dot, len, normalize, scale, sub, type Vec3,
} from '@weasel-js/geom/3d';
import { cameraBasis } from '../camera';
import { castOntoPlane, projectPoint, rectOf, viewProjectionOf, type Viewport3d } from '../project';
import { projectAabbToScreen } from '../screen';
import { DEFAULT_UP, viewportOf, type World3d } from '../world';
import { inputFlat3d, planeBasis, tuple, vec3Of } from './plane';
import { landingOf } from './landing';
import { boxProbes, subjectOf } from './probes3d';

type Point = { x: number; y: number };

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

/** What a 3D session runs on. */
export interface Session3dInputs<TData, TLayer extends string> {
  req: SnapBegin;
  world: World3d<TData, TLayer>;
  /** In source order: earlier wins a full tie. */
  sources: readonly SnapSource<Vec3>[];
  /** The reach of a source that sets none, in screen px. */
  reachPx: number;
  store: SnapOutcomeStore<Vec3>;
  /** The view whose camera the gesture is cast through. */
  viewId?: string | null | undefined;
}

/**
 * The plane a gesture's pointer is cast onto, `normal · p = offset`, and how
 * its δ is read: as the world distance between where `anchor` and the
 * pointer's offset from the press cast onto that plane, held to `along` when
 * the gesture moves along a line. For a level move, `anchor` is the screen
 * point `translate` casts from, so a δ handed back as a screen point is the
 * delta `translate` makes of it.
 */
interface Frame {
  plane(vp: Viewport3d): { normal: Vec3; offset: number } | null;
  anchor(vp: Viewport3d): Point | null;
  probes(anchorWorld: Vec3): readonly SnapProbeAt<Vec3>[];
  /** The point the landing is measured from, given where the press cast. */
  from(anchorWorld: Vec3): Vec3;
  along?: Vec3;
}

/**
 * A snap session over a 3D world: ctx points are screen points. A move runs
 * on the plane through its subject normal to `up`, or along `req.along` on
 * the plane through it facing the camera; an insert runs on the ground. Each
 * returns the screen point whose cast lands where the snap put it, and the
 * world point itself as its landing (`Landing3d`). Other gestures pass their
 * input through.
 */
export function createSession3d<TData, TLayer extends string>(inputs: Session3dInputs<TData, TLayer>): SnapSession {
  const { req, world, store } = inputs;
  const up = normalize(world.up ?? DEFAULT_UP);
  const basis = planeBasis(up);
  const frame = frameOf(req, world, up);
  const sources = snapSourcesFor(inputs.sources, req.gesture);
  // A line move keeps its last landing through a frame that casts nothing, rather than falling back to a level one.
  let last: SnapOutcome | null = null;
  const unsnapped = (p: Point): SnapOutcome => {
    store.set([]);
    if (frame?.along && last) return last;
    return { point: p, held: false, marks: [] };
  };
  return {
    at(p, mods) {
      if (!frame) return unsnapped(p);
      const vp = viewportOf(world, inputs.viewId);
      const plane = frame.plane(vp);
      const screen = plane && frame.anchor(vp);
      const anchor = screen && castOntoPlane(vp, screen, plane.normal, plane.offset);
      const hit = screen && castOntoPlane(vp, { x: screen.x + p.x - req.press.x, y: screen.y + p.y - req.press.y }, plane.normal, plane.offset);
      if (!plane || !screen || !anchor || !hit) return unsnapped(p);
      const cast = sub(hit, anchor);
      const delta0 = frame.along ? scale(frame.along, dot(cast, frame.along)) : cast;
      const origin = req.origin ? castOntoPlane(vp, req.origin, plane.normal, plane.offset) : null;
      const input = frame.along
        ? { at: [0, 0, 0], dirs: [tuple(frame.along)] }
        : inputFlat3d(req.constrain, mods.constrain, basis, delta0, origin ? sub(origin, anchor) : ZERO);
      const probes = frame.probes(anchor);
      let delta: Vec3;
      let held = false;
      let met: readonly { probe: string; locus: Flat }[] = [];
      if (mods.suspend) {
        delta = vec3Of(closestOnFlat(input, tuple(delta0)));
        store.set([]);
      } else {
        const at = probes.map((q) => ({ id: q.id, at: tuple(q.at), role: q.role }));
        const res = resolveHolding(candidatesOf(inputs, sources, probes, delta0, vp, origin, input), (kept) => resolveSnap({
          probes: at,
          input,
          delta0: tuple(delta0),
          candidates: kept,
          toScreen: (w) => {
            const s = projectPoint(vec3Of(w), vp);
            return s ? [s.x, s.y] : [NaN, NaN];
          },
        }), vec3Of);
        delta = vec3Of(res.delta);
        held = res.members.length > 0;
        met = res.members;
        store.set(resolvedSnapMarks(res.satisfied, delta));
      }
      const landed = projectPoint(add(anchor, delta), vp);
      if (!landed) return unsnapped(p);
      last = {
        point: { x: req.press.x + landed.x - screen.x, y: req.press.y + landed.y - screen.y },
        held,
        marks: store.get(),
        landing: landingOf(frame.from(anchor), delta, input.dirs, probes, met),
      };
      return last;
    },
    angle: (theta) => ({ theta, marks: [] }),
    end() {
      store.set([]);
    },
  };
}

function frameOf<TData, TLayer extends string>(req: SnapBegin, world: World3d<TData, TLayer>, up: Vec3): Frame | null {
  if (req.gesture === 'point') {
    return {
      plane: () => ({ normal: up, offset: 0 }),
      anchor: () => req.press,
      probes: (at) => [{ id: 'pointer', at, role: 'pointer' }],
      from: (at) => at,
    };
  }
  if (req.gesture !== 'move') return null;
  const subject = subjectOf(world, req.ids ?? [], up);
  if (!subject) return null;
  const probes = boxProbes(subject.box);
  const from = () => subject.anchor.position;
  const along = alongOf(req.along);
  if (along) {
    const center = scale(add(subject.anchor.box.min, subject.anchor.box.max), 0.5);
    return {
      along,
      plane(vp) {
        const normal = facingAlong(cameraBasis(vp.camera, vp.up).forward, along);
        return normal && { normal, offset: dot(normal, center) };
      },
      anchor: (vp) => projectPoint(center, vp),
      probes: () => probes,
      from,
    };
  }
  return {
    plane: () => ({ normal: up, offset: subject.anchor.height }),
    anchor(vp) {
      const box = projectAabbToScreen(subject.anchor.box, viewProjectionOf(vp), rectOf(vp));
      return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
    },
    probes: () => probes,
    from,
  };
}

/** `along` as a unit direction, or undefined for none or one with no length. */
function alongOf(along: readonly number[] | undefined): Vec3 | undefined {
  if (!along || along.length !== 3) return undefined;
  const v = { x: along[0]!, y: along[1]!, z: along[2]! };
  const n = len(v);
  return n > 0 && Number.isFinite(n) ? (n === 1 ? v : scale(v, 1 / n)) : undefined;
}

/** The normal of the plane containing `along` that most faces the camera, or null when `along` points at it. */
function facingAlong(forward: Vec3, along: Vec3): Vec3 | null {
  const n = sub(forward, scale(along, dot(forward, along)));
  return len(n) < 1e-6 ? null : normalize(n);
}

function candidatesOf<TData, TLayer extends string>(
  inputs: Session3dInputs<TData, TLayer>, sources: readonly SnapSource<Vec3>[], probes: readonly SnapProbeAt<Vec3>[],
  delta0: Vec3, vp: Viewport3d, origin: Vec3 | null, input: Flat,
): GatheredCandidate<Vec3>[] {
  const { req } = inputs;
  const shifted = probes.map((q) => ({ ...q, at: add(q.at, delta0) }));
  const perPx = worldPerPx(vp, shifted);
  const found = gatherSnapCandidates(sources, shifted, (_source, offered, reachPx) => ({
    gesture: req.gesture, probes: offered, delta0, exclude: req.exclude ?? req.ids ?? [],
    ...(req.ids ? { ids: req.ids } : {}),
    ...(req.parent !== undefined ? { parent: req.parent } : {}),
    ...(origin ? { origin } : {}),
    reachWorld: (px) => px * perPx,
    reachPx,
  }), { toVec: tuple, reachPx: inputs.reachPx, ...(origin ? { origin } : {}) });
  return found.filter((c) => !parallel(c.locus, input));
}

/** Whether `locus` is a plane every direction of `input` runs along: the
 *  gesture's own plane or one parallel to it, which the move alone meets or
 *  misses — for a level move, the planes height alone decides. */
function parallel(locus: Flat, input: Flat): boolean {
  if (locus.dirs.length !== 2) return false;
  const n = cross(vec3Of(locus.dirs[0]!), vec3Of(locus.dirs[1]!));
  return input.dirs.every((d) => Math.abs(dot(n, vec3Of(d))) <= 1e-9 * len(n) * len(vec3Of(d)));
}

/** World units per screen px at the farthest probe in front of the camera:
 *  the radius that culls by reach without dropping anything in it. */
function worldPerPx(vp: Viewport3d, probes: readonly SnapProbeAt<Vec3>[]): number {
  const { eye, forward } = cameraBasis(vp.camera, vp.up);
  const k = (2 * Math.tan(vp.camera.fov / 2)) / Math.max(1, vp.height);
  let depth = 0;
  for (const q of probes) depth = Math.max(depth, dot(sub(q.at, eye), forward));
  return depth * k;
}
