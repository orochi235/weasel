import { expect } from 'vitest';
import {
  createScene,
  createSnapSession2d,
  type Bounds,
  type ResizeAnchor,
  type Scene,
  type SnapGesture,
  type SnapMods,
  type SnapOutcome,
  type SnapSource,
} from '@weasel-js/core';

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;

export const FREE: SnapMods = { suspend: false, constrain: false };

/** `a` is `b` to nine places, on both axes. */
export function expectNear(a: Point, b: Point): void {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
}

/** A node's pose, and what it is drawn with. */
export type Shape = Bounds & { rotation?: number; data?: object };

/** A scene of top-level rects, and their ids in order. */
export function sceneOf(shapes: readonly Shape[] = []): { scene: AnyScene; ids: string[] } {
  const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  const ids = shapes.map(({ data, ...pose }) => scene.add({ kind: 'leaf', layer: 'default', pose, data: data ?? {} }) as string);
  return { scene: scene as unknown as AnyScene, ids };
}

interface DriveOpts {
  sources: readonly SnapSource[];
  gesture?: SnapGesture;
  press?: Point;
  ids?: readonly string[];
  handle?: ResizeAnchor;
  /** Default: an empty scene. */
  scene?: AnyScene;
  /** The view's zoom. Default 1. */
  scale?: number;
  reachPx?: number;
}

/** A snap session over `opts.scene`, as a host without `<SceneCanvas>` runs one. */
export function drive(opts: DriveOpts) {
  const scale = opts.scale ?? 1;
  const session = createSnapSession2d({
    scene: opts.scene ?? sceneOf().scene,
    view: { x: 0, y: 0, scale: { x: scale, y: scale } },
    sources: opts.sources,
    gesture: opts.gesture ?? 'point',
    press: opts.press ?? { x: 0, y: 0 },
    ...(opts.ids ? { ids: opts.ids } : {}),
    ...(opts.handle ? { handle: opts.handle } : {}),
    ...(opts.reachPx !== undefined ? { reachPx: opts.reachPx } : {}),
  });
  return { session, at: (p: Point, mods: SnapMods = FREE): SnapOutcome => session.at(p, mods) };
}

/** A move dragged by `by`, from a press at the origin: the delta it settles
 *  on. With no `scene`, the subject is one unstroked rect at `box`. */
export function moveBy(opts: Omit<DriveOpts, 'gesture' | 'press'> & { box?: Bounds }) {
  const own = opts.scene ? null : sceneOf(opts.box ? [opts.box] : []);
  const d = drive({
    ...opts,
    gesture: 'move',
    scene: opts.scene ?? own!.scene,
    ids: opts.ids ?? own!.ids,
  });
  return { ...d, by: (dx: number, dy: number, mods?: SnapMods) => d.at({ x: dx, y: dy }, mods) };
}
