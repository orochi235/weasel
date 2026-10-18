import { expect } from 'vitest';
import {
  createSession2d,
  createSnapOutcomeStore,
  DEFAULT_SNAP_PX,
  type Bounds,
  type Scene,
  type SnapGesture,
  type SnapMods,
  type SnapOutcome,
  type SnapProbeAt,
  type SnapSource,
} from '@weasel-js/core';

type Point = { x: number; y: number };

export const FREE: SnapMods = { suspend: false, constrain: false };

/** `a` is `b` to nine places, on both axes. */
export function expectNear(a: Point, b: Point): void {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
}

/** The probes a move of `box` snaps, as core builds them: the pose origin at
 *  `origin` (default the box's corner), and the box's min, center and max. */
export function moveProbes(box: Bounds, origin: Point = { x: box.x, y: box.y }): SnapProbeAt[] {
  return [
    { id: 'origin:a', at: origin, role: 'origin' },
    { id: 'box.min', at: { x: box.x, y: box.y }, role: 'box' },
    { id: 'box.center', at: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, role: 'box' },
    { id: 'box.max', at: { x: box.x + box.width, y: box.y + box.height }, role: 'box' },
  ];
}

interface DriveOpts {
  sources: readonly SnapSource[];
  gesture?: SnapGesture;
  /** Probes at press. Default a pointer probe at `press`. */
  probes?: readonly SnapProbeAt[];
  press?: Point;
  ids?: readonly string[];
  scene?: Scene<unknown, string, unknown>;
  /** The view's zoom. Default 1. */
  scale?: number;
  reachPx?: number;
}

/** A 2D snap session over `opts`, and the store it writes its marks to. */
export function drive(opts: DriveOpts) {
  const store = createSnapOutcomeStore();
  const press = opts.press ?? { x: 0, y: 0 };
  const scale = opts.scale ?? 1;
  const session = createSession2d({
    req: { gesture: opts.gesture ?? 'point', press, ...(opts.ids ? { ids: opts.ids } : {}) },
    sources: opts.sources,
    probes: opts.probes ?? [{ id: 'pointer', at: press, role: 'pointer' }],
    view: () => ({ x: 0, y: 0, scale: { x: scale, y: scale } }),
    reachPx: opts.reachPx ?? DEFAULT_SNAP_PX,
    ...(opts.scene ? { scene: opts.scene } : {}),
    store,
  });
  return { session, store, at: (p: Point, mods: SnapMods = FREE): SnapOutcome => session.at(p, mods) };
}

/** A move of `box` dragged by `by`: the delta the session settles on. */
export function moveBy(opts: Omit<DriveOpts, 'gesture' | 'probes' | 'press'> & { box: Bounds; origin?: Point }) {
  const d = drive({ ...opts, gesture: 'move', probes: moveProbes(opts.box, opts.origin) });
  return { ...d, by: (dx: number, dy: number, mods?: SnapMods) => d.at({ x: dx, y: dy }, mods) };
}
