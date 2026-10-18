import {
  gatherSnapCandidates, resolvedSnapMarks, snapSourcesFor,
  type SnapBegin, type SnapCandidateMark, type SnapOutcome, type SnapOutcomeStore,
  type SnapProbeAt, type SnapSession, type SnapSource,
} from '@weasel-js/core';
import { closestOnFlat, resolveSnap, type Flat, type SnapCandidate } from '@weasel-js/geom/nd';
import {
  add, cross, dot, intersectRayPlane, len, normalize, pointOnRay, sub, type Vec3,
} from '@weasel-js/geom/3d';
import { cameraEye } from '../camera';
import { projectPoint, rayAt, rectOf, viewProjectionOf, type Viewport3d } from '../project';
import { projectAabbToScreen } from '../screen';
import { DEFAULT_UP, type World3d } from '../world';
import { inputFlat3d, planeBasis, tuple, vec3Of } from './plane';
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
}

/**
 * The plane a gesture moves on, `up · p = offset`, and how its δ is read: as
 * the world distance between where `anchor` and the pointer's offset from the
 * press cast onto that plane. For a move, `anchor` is the screen point
 * `translate` casts from, so a δ handed back as a screen point is the delta
 * `translate` makes of it.
 */
interface Frame {
  offset: number;
  anchor(vp: Viewport3d): Point | null;
  probes(anchorWorld: Vec3): readonly SnapProbeAt<Vec3>[];
}

/**
 * A snap session over a 3D world: ctx points are screen points. A move runs
 * on the plane through its subject normal to `up`, an insert on the ground,
 * and each returns the screen point whose cast lands where the snap put it.
 * Other gestures pass their input through.
 */
export function createSession3d<TData, TLayer extends string>(inputs: Session3dInputs<TData, TLayer>): SnapSession {
  const { req, world, store } = inputs;
  const up = normalize(world.up ?? DEFAULT_UP);
  const basis = planeBasis(up);
  const frame = frameOf(req, world, up);
  const sources = snapSourcesFor(inputs.sources, req.gesture);
  const unsnapped = (p: Point): SnapOutcome => {
    store.set([]);
    return { point: p, held: false, marks: [] };
  };
  return {
    at(p, mods) {
      if (!frame) return unsnapped(p);
      const vp = world.viewport();
      const screen = frame.anchor(vp);
      const anchor = screen && castOnto(vp, screen, up, frame.offset);
      const hit = screen && castOnto(vp, { x: screen.x + p.x - req.press.x, y: screen.y + p.y - req.press.y }, up, frame.offset);
      if (!screen || !anchor || !hit) return unsnapped(p);
      const delta0 = sub(hit, anchor);
      const origin = req.origin ? castOnto(vp, req.origin, up, frame.offset) : null;
      const input = inputFlat3d(req.constrain, mods.constrain, basis, delta0, origin ? sub(origin, anchor) : ZERO);
      let delta: Vec3;
      let held = false;
      if (mods.suspend) {
        delta = vec3Of(closestOnFlat(input, tuple(delta0)));
        store.set([]);
      } else {
        const probes = frame.probes(anchor);
        const res = resolveSnap({
          probes: probes.map((q) => ({ id: q.id, at: tuple(q.at), role: q.role })),
          input,
          delta0: tuple(delta0),
          candidates: candidatesOf(inputs, sources, probes, delta0, vp, origin, up),
          toScreen: (w) => {
            const s = projectPoint(vec3Of(w), vp);
            return s ? [s.x, s.y] : [NaN, NaN];
          },
        });
        delta = vec3Of(res.delta);
        held = res.members.length > 0;
        store.set(resolvedSnapMarks(res.satisfied, delta));
      }
      const landed = projectPoint(add(anchor, delta), vp);
      if (!landed) return unsnapped(p);
      return {
        point: { x: req.press.x + landed.x - screen.x, y: req.press.y + landed.y - screen.y },
        held,
        marks: store.get(),
      };
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
      offset: 0,
      anchor: () => req.press,
      probes: (at) => [{ id: 'pointer', at, role: 'pointer' }],
    };
  }
  if (req.gesture !== 'move') return null;
  const subject = subjectOf(world, req.ids ?? [], up);
  if (!subject) return null;
  const probes = boxProbes(subject.box);
  return {
    offset: subject.anchor.height,
    anchor(vp) {
      const box = projectAabbToScreen(subject.anchor.box, viewProjectionOf(vp), rectOf(vp));
      return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
    },
    probes: () => probes,
  };
}

function castOnto(vp: Viewport3d, s: Point, up: Vec3, offset: number): Vec3 | null {
  const ray = rayAt(vp, s);
  const t = ray && intersectRayPlane(ray, up, offset);
  return ray && t !== null ? pointOnRay(ray, t) : null;
}

function candidatesOf<TData, TLayer extends string>(
  inputs: Session3dInputs<TData, TLayer>, sources: readonly SnapSource<Vec3>[], probes: readonly SnapProbeAt<Vec3>[],
  delta0: Vec3, vp: Viewport3d, origin: Vec3 | null, up: Vec3,
): SnapCandidate<SnapCandidateMark<Vec3>>[] {
  const { req } = inputs;
  const shifted = probes.map((q) => ({ ...q, at: add(q.at, delta0) }));
  const perPx = worldPerPx(vp, shifted);
  const found = gatherSnapCandidates(sources, shifted, (_source, offered, reachPx) => ({
    gesture: req.gesture, probes: offered, delta0, exclude: req.ids ?? [],
    ...(origin ? { origin } : {}),
    reachWorld: (px) => px * perPx,
    reachPx,
  }), { toVec: tuple, reachPx: inputs.reachPx, ...(origin ? { origin } : {}) });
  return found.filter((c) => !level(c.locus, up));
}

/** Whether `locus` is a plane normal to `up`: the gesture's own plane or one
 *  parallel to it, which height alone meets or misses. */
function level(locus: Flat, up: Vec3): boolean {
  if (locus.dirs.length !== 2) return false;
  const n = cross(vec3Of(locus.dirs[0]!), vec3Of(locus.dirs[1]!));
  return Math.abs(dot(n, up)) >= (1 - 1e-9) * len(n);
}

/** World units per screen px at the farthest probe in front of the camera:
 *  the radius that culls by reach without dropping anything in it. */
function worldPerPx(vp: Viewport3d, probes: readonly SnapProbeAt<Vec3>[]): number {
  const eye = cameraEye(vp.camera);
  const forward = normalize(sub(vp.camera.target, eye));
  const k = (2 * Math.tan(vp.camera.fov / 2)) / Math.max(1, vp.height);
  let depth = 0;
  for (const q of probes) depth = Math.max(depth, dot(sub(q.at, eye), forward));
  return depth * k;
}
