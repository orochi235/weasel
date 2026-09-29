/**
 * Editing a node on a parallax plane.
 *
 * The dispatcher hands every action the camera's world. A node on a layer
 * carrying `parallax` stores its pose in its plane's world, which the camera's
 * reaches through a `PlaneMap` that changes with the camera. An editing action
 * pairs the pointer with the pose it edits, so the two have to be in one world.
 *
 * `inPlane` is that one place: it wraps an action so its input is carried into
 * the plane of the layer it edits before the action reads it — pointer, drag,
 * trail, affordance pivot, and the camera it converts screen pixels through —
 * and so the chrome it publishes back comes out in the camera's world. A dep
 * that answers in world points (`nodeAtPoint`, `snap`) is the surface's, so it
 * keeps speaking the camera's world and the seam converts at its boundary.
 * The action itself never learns there was a plane.
 *
 * The map is read afresh on every call: a camera panning under a held drag, or
 * a plane whose factors are being animated, moves the node with the pointer.
 */
import type {
  Action, BindingOpts, DragSample, InvocationCtx, OngoingHandle, OngoingOverlay,
} from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import {
  deriveParallaxView, fromPlane, planeMap, rectFromPlane, toPlane,
  type ParallaxOpts, type PlaneMap,
} from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import type { InsertDep, NodeAtPointDep, SnapDep, ViewApi } from './depSchema';

type Point = { x: number; y: number };

/** Which scene layer an invocation edits, read once at `start`. `undefined`
 *  means none — the action runs in the camera's world. */
export type EditedLayerOf = (ctx: InvocationCtx) => string | undefined;

/** The layer of the node a selection edit acts on: the affordance's target
 *  when the drag grabbed one, the first selected node otherwise. A selection
 *  spanning planes is edited in that one node's plane. */
export const selectionLayer: EditedLayerOf = (ctx) => {
  const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;
  if (!scene) return undefined;
  const selection = ctx.deps.selection as SelectionApi | undefined;
  const candidates = [...(ctx.drag?.affordance?.targetIds ?? []), ...(selection?.get() ?? [])];
  for (const id of candidates) {
    const node = scene.get(asNodeId(id));
    if (node) return node.layer;
  }
  return undefined;
};

/** The layer the `insert` dep will put a new node on. */
export const insertLayer: EditedLayerOf = (ctx) =>
  (ctx.deps.insert as InsertDep | undefined)?.layer?.();

/** `action`, with its input carried into the plane of the layer `layerOf`
 *  names. An action on a layer with no `parallax`, or invoked with no scene or
 *  view to read the plane from, runs exactly as it would unwrapped. */
export function inPlane<A extends Action>(action: A, layerOf: EditedLayerOf): A {
  const inner = action.invoker;
  if (inner?.timing !== 'ongoing') return action;
  const requires = [...new Set([...(action.requires ?? []), 'scene', 'selection', 'view'])];
  return {
    ...action,
    requires,
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
        const plane = livePlane(ctx, layerOf(ctx), action.requires ?? []);
        if (plane === null) return inner.start(ctx, opts);
        return planeHandle(inner.start(plane.carry(ctx), opts), plane);
      },
    },
  } as A;
}

interface LivePlane {
  map(): PlaneMap;
  /** `ctx` in the plane's world. */
  carry(ctx: InvocationCtx): InvocationCtx;
}

function livePlane(
  ctx: InvocationCtx,
  layer: string | undefined,
  /** What the wrapped action declared. The dispatcher's dev deps bag throws
   *  on any other read, so the seam converts only the deps it can see. */
  declared: readonly string[],
): LivePlane | null {
  const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;
  const viewApi = ctx.deps.view as ViewApi | undefined;
  if (layer === undefined || !scene || !viewApi) return null;
  const parallax = (): ParallaxOpts | undefined => scene.layers.find((l) => l.id === layer)?.parallax;
  if (parallax() === undefined) return null;

  const IDENTITY: PlaneMap = { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };
  const map = (): PlaneMap => {
    const p = parallax();
    return p ? planeMap(viewApi.get(), p) : IDENTITY;
  };

  // A screen-pixel tolerance, and anything else an action reads off the
  // camera, has to be read at the plane's scale.
  const planeView = Object.defineProperty(Object.create(viewApi), 'get', {
    value: (): View => {
      const p = parallax();
      const camera = viewApi.get();
      return p ? deriveParallaxView(camera, p) : camera;
    },
  }) as ViewApi;

  // Over the dispatcher's bag rather than a copy of it, so every other read
  // still goes through whatever checks the bag makes.
  const deps = Object.create(ctx.deps) as typeof ctx.deps;
  const override = (name: string, value: unknown) =>
    Object.defineProperty(deps, name, { value, enumerable: true });
  override('view', planeView);
  const nodeAtPoint = declared.includes('nodeAtPoint')
    ? ctx.deps.nodeAtPoint as NodeAtPointDep | undefined
    : undefined;
  if (nodeAtPoint) {
    override('nodeAtPoint', ((p, exclude) => nodeAtPoint(fromPlane(map(), p), exclude)) as NodeAtPointDep);
  }
  const snap = declared.includes('snap') ? ctx.deps.snap as SnapDep | undefined : undefined;
  if (snap) {
    override('snap', { point: (p: Point) => toPlane(map(), snap.point(fromPlane(map(), p))) } as SnapDep);
  }

  // The drag's origin, fixed in the plane at the moment it was pressed: where
  // the pointer went down on the node is where the node was grabbed, whatever
  // the camera does after.
  const start0 = ctx.drag ? toPlane(map(), ctx.drag.start) : null;
  const trail = trailCarrier();

  return {
    map,
    carry(c) {
      const m = map();
      const out: InvocationCtx = { ...c, world: toPlane(m, c.world) };
      if (c.drag) {
        const start = start0 ?? toPlane(m, c.drag.start);
        const current = toPlane(m, c.drag.current);
        const aff = c.drag.affordance;
        out.drag = {
          ...c.drag,
          start,
          current,
          delta: { x: current.x - start.x, y: current.y - start.y },
          ...(c.drag.points ? { points: trail(c.drag.points, m) } : {}),
          ...(aff?.fixedPoint ? { affordance: { ...aff, fixedPoint: toPlane(m, aff.fixedPoint) } } : {}),
        };
      }
      // The dispatcher hands `onMove` no deps; only `start` has any to carry.
      if (c.deps) out.deps = deps;
      return out;
    },
  };
}

/** The drag trail in the plane. The dispatcher grows its trail in place, so
 *  only the samples added since the last call are mapped — unless the map
 *  moved, when every sample is. */
function trailCarrier(): (points: DragSample[], m: PlaneMap) => DragSample[] {
  let src: DragSample[] | null = null;
  let lastMap: PlaneMap | null = null;
  let out: DragSample[] = [];
  return (points, m) => {
    const same = lastMap !== null
      && lastMap.scale.x === m.scale.x && lastMap.scale.y === m.scale.y
      && lastMap.offset.x === m.offset.x && lastMap.offset.y === m.offset.y;
    if (points !== src || !same || points.length < out.length) {
      src = points;
      out = [];
    }
    lastMap = m;
    for (let i = out.length; i < points.length; i++) {
      out.push({ ...points[i], ...toPlane(m, points[i]) });
    }
    // A copy, so a snapshot taken on `onEnd` is not the live accumulator.
    return out.slice();
  };
}

function planeHandle(handle: OngoingHandle, plane: LivePlane): OngoingHandle {
  const out: OngoingHandle = { ...handle };
  if (handle.onMove) out.onMove = (c) => handle.onMove!(plane.carry(c));
  if (handle.onEnd) out.onEnd = (c, reason) => handle.onEnd!(plane.carry(c), reason);
  if (handle.overlay) {
    out.overlay = () => {
      const ov = handle.overlay!();
      return ov ? overlayFromPlane(ov, plane.map()) : ov;
    };
  }
  return out;
}

/** An overlay drawn in the plane, in the camera's world: what every painter
 *  reads an overlay as. */
function overlayFromPlane(ov: OngoingOverlay, m: PlaneMap): OngoingOverlay {
  const pt = (p: Point) => fromPlane(m, p);
  switch (ov.kind) {
    case 'marquee':
      return { ...ov, start: pt(ov.start), current: pt(ov.current) };
    case 'lasso':
      return { ...ov, vertices: ov.vertices.map(pt), current: pt(ov.current) };
    case 'polyline':
      return { ...ov, points: ov.points.map(pt) };
    case 'insertPreview':
      return {
        ...ov,
        bounds: rectFromPlane(m, ov.bounds),
        extras: insertExtrasFromPlane(ov.extras, m),
        ...(ov.anchorPoint ? { anchorPoint: pt(ov.anchorPoint) } : {}),
      };
  }
}

/** The geometry the kit's insert kinds carry in `extras`, in the camera's
 *  world. A consumer kind's extras are opaque, and pass through. */
function insertExtrasFromPlane(extras: unknown, m: PlaneMap): unknown {
  if (extras === null || typeof extras !== 'object') return extras;
  const e = extras as Record<string, unknown>;
  const pt = (p: unknown) => fromPlane(m, p as Point);
  // Radial kinds inscribe in a square, so one scale carries a radius.
  const r = (v: unknown) => (typeof v === 'number' ? v / ((m.scale.x + m.scale.y) / 2) : v);
  const out: Record<string, unknown> = { ...e };
  if (e['a'] && e['b']) { out['a'] = pt(e['a']); out['b'] = pt(e['b']); }
  if (e['center']) out['center'] = pt(e['center']);
  if ('radius' in e) out['radius'] = r(e['radius']);
  if ('outerRadius' in e) out['outerRadius'] = r(e['outerRadius']);
  if (Array.isArray(e['samples'])) {
    out['samples'] = (e['samples'] as DragSample[]).map((s) => ({ ...s, ...pt(s) }));
  }
  return out;
}
