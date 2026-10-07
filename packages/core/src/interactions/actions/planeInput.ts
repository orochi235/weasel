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
 * The action sees the plane only as `view.plane()`, which it hands its snap
 * behaviors so they can bring the camera's guides and grid into the plane.
 *
 * A selection can span planes. The edit is measured in one of them, and a
 * node on another is carried into it as the gesture starts
 * (`planeOf` at press, inverted) and back out through `planeOf` as it is now,
 * so each node ends where it was drawn relative to the pointer.
 *
 * The map is read afresh on every call: a camera panning under a held drag, or
 * a plane whose factors are being animated, moves the node with the pointer.
 */
import type {
  Action, ActionDeps, AffordanceHit, BindingOpts, DragSample, InvocationCtx, OngoingHandle,
  OngoingOverlay,
} from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import {
  deriveParallaxView, fromPlane, planeMap, planeToPlane, rectFromPlane, rectToPlane, toPlane,
  type ParallaxOpts, type PlaneMap,
} from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { NodeAtPointDep, SnapDep, ViewApi } from './depSchema';

type Point = { x: number; y: number };

/** Which scene layer an invocation edits, read once as it starts, from its
 *  deps and — for a drag — the affordance it grabbed. `undefined` means none:
 *  the action runs in the camera's world. */
export type EditedLayerOf = (deps: ActionDeps, affordance?: AffordanceHit) => string | undefined;

const layerOfNode = (deps: ActionDeps, id: string | null | undefined): string | undefined =>
  (id ? deps.scene?.get(asNodeId(id))?.layer : undefined);

/** The layer of the node a selection edit acts on: the affordance's target
 *  when the drag grabbed one, the first selected node otherwise. A selection
 *  spanning planes is edited in that one node's plane. */
export const selectionLayer: EditedLayerOf = (deps, affordance) => {
  const selection = deps.selection;
  for (const id of [...(affordance?.targetIds ?? []), ...(selection?.get() ?? [])]) {
    const layer = layerOfNode(deps, id);
    if (layer !== undefined) return layer;
  }
  return undefined;
};

/** The layer the `insert` dep will put a new node on. */
export const insertLayer: EditedLayerOf = (deps) =>
  deps.insert?.layer?.();

/** The layer of the path in anchor-edit mode. */
export const editingLayer: EditedLayerOf = (deps) =>
  layerOfNode(deps, deps.editAnchors?.editingId);

/** How the world an invocation edits in maps into the world `layer`'s nodes
 *  are stored in, read now. Null when they are the same world. */
export function planeOf(view: unknown, layer: string): PlaneMap | null {
  return (view as ViewApi | undefined)?.planeOf?.(layer) ?? null;
}

/** `m` run backwards; null stays null. */
export function invertPlane(m: PlaneMap | null): PlaneMap | null {
  return m && planeToPlane(m, null);
}

/** `pose` carried through `m`. The map is axis-aligned, so remapping the
 *  pose's bounds carries it exactly when the map scales both axes alike. */
export function carryPose<P>(d: PoseDescriptor<P>, pose: P, m: PlaneMap | null): P {
  if (m === null) return pose;
  const b = d.getBounds(pose);
  return d.remapBounds(pose, b, rectToPlane(m, b));
}

/** `action`, with its input carried into the plane of the layer `layerOf`
 *  names. An action in a scene with no `parallax` layer, or invoked with no
 *  scene or view to read a plane from, runs exactly as it would unwrapped.
 *
 *  An ongoing action's drag is carried as a whole. An immediate one's world
 *  point is `params.worldX` / `params.worldY`, the dispatcher's convention for
 *  a click; it is carried when present. */
export function inPlane<A extends Action>(action: A, layerOf: EditedLayerOf): A {
  const inner = action.invoker;
  if (!inner) return action;
  const declared = action.requires ?? [];
  const requires = [...new Set([...declared, 'scene', 'selection', 'view'])];
  if (inner.timing === 'immediate') {
    return {
      ...action,
      requires,
      invoker: {
        timing: 'immediate',
        run(deps: ActionDeps, params?: Record<string, unknown>): void {
          const plane = livePlane(deps, layerOf(deps), declared, null);
          if (plane === null) return inner.run(deps, params);
          const wx = params?.['worldX'];
          const wy = params?.['worldY'];
          const at = typeof wx === 'number' && typeof wy === 'number'
            ? toPlane(plane.map(), { x: wx, y: wy })
            : null;
          inner.run(plane.deps, at ? { ...params, worldX: at.x, worldY: at.y } : params);
        },
      },
    } as A;
  }
  return {
    ...action,
    requires,
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
        const plane = livePlane(
          ctx.deps, layerOf(ctx.deps, ctx.drag?.affordance), declared, ctx.drag?.start ?? null,
        );
        if (plane === null) return inner.start(ctx, opts);
        return planeHandle(inner.start(plane.carry(ctx), opts), plane);
      },
    },
  } as A;
}

interface LivePlane {
  map(): PlaneMap;
  /** The invocation's deps, speaking the plane's world. */
  deps: ActionDeps;
  /** `ctx` in the plane's world. */
  carry(ctx: InvocationCtx): InvocationCtx;
}

function livePlane(
  bag: ActionDeps,
  layer: string | undefined,
  /** What the wrapped action declared. The dispatcher's dev deps bag throws
   *  on any other read, so the seam converts only the deps it can see. */
  declared: readonly string[],
  /** The drag's press point in the camera's world, when there is a drag. */
  pressedAt: Point | null,
): LivePlane | null {
  const scene = bag.scene as Scene<unknown, string, unknown> | undefined;
  const viewApi = bag.view as ViewApi | undefined;
  if (layer === undefined || !scene || !viewApi) return null;
  if (!scene.layers.some((l) => l.parallax !== undefined)) return null;
  const parallaxOf = (id: string): ParallaxOpts | undefined => scene.layers.find((l) => l.id === id)?.parallax;
  const parallax = (): ParallaxOpts | undefined => parallaxOf(layer);

  const IDENTITY: PlaneMap = { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };
  const map = (): PlaneMap => {
    const p = parallax();
    return p ? planeMap(viewApi.get(), p) : IDENTITY;
  };

  // A screen-pixel tolerance, and anything else an action reads off the
  // camera, has to be read at the plane's scale.
  const planeView = Object.defineProperties(Object.create(viewApi), {
    get: {
      value: (): View => {
        const p = parallax();
        const camera = viewApi.get();
        return p ? deriveParallaxView(camera, p) : camera;
      },
    },
    plane: { value: map },
    planeOf: {
      value: (id: string): PlaneMap | null => {
        const edited = parallax();
        const own = parallaxOf(id);
        const camera = viewApi.get();
        return planeToPlane(edited ? planeMap(camera, edited) : null, own ? planeMap(camera, own) : null);
      },
    },
  }) as ViewApi;

  // Over the dispatcher's bag rather than a copy of it, so every other read
  // still goes through whatever checks the bag makes.
  const deps = Object.create(bag) as typeof bag;
  const override = (name: string, value: unknown) =>
    Object.defineProperty(deps, name, { value, enumerable: true });
  override('view', planeView);
  const nodeAtPoint = declared.includes('nodeAtPoint')
    ? bag.nodeAtPoint as NodeAtPointDep | undefined
    : undefined;
  if (nodeAtPoint) {
    override('nodeAtPoint', ((p, exclude) => nodeAtPoint(fromPlane(map(), p), exclude)) as NodeAtPointDep);
  }
  const snap = declared.includes('snap') ? bag.snap as SnapDep | undefined : undefined;
  if (snap) {
    override('snap', { point: (p: Point) => toPlane(map(), snap.point(fromPlane(map(), p))) } as SnapDep);
  }

  // The drag's origin, fixed in the plane at the moment it was pressed: where
  // the pointer went down on the node is where the node was grabbed, whatever
  // the camera does after.
  const start0 = pressedAt ? toPlane(map(), pressedAt) : null;
  const trail = trailCarrier();

  return {
    map,
    deps,
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
