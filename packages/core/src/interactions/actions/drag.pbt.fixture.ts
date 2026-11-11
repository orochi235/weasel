/**
 * Driving the ongoing (drag) actions through their invokers, for the property tests. Test-only: nothing in the
 * package imports it.
 */
import type { Action, ActionDeps, BindingOpts, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { RESIZE_HANDLE_ANCHORS } from './resize/cornerHandles';
import type { TestScene } from './pbt.fixture';

export interface Pt { x: number; y: number }

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

/** The invocation one point of a drag from `start` makes: the pointer at `p`, screen and world alike. */
export function dragCtx(deps: ActionDeps, start: Pt, p: Pt, affordance?: unknown): InvocationCtx {
  const delta = { x: p.x - start.x, y: p.y - start.y };
  return {
    world: p, screen: p, modifiers: NO_MODS, deps,
    drag: { start, current: p, delta, screenDelta: delta, ...(affordance ? { affordance } : {}) },
  } as InvocationCtx;
}

/** A gesture through `action`: press at `start`, a move to each of `path`, and an end at the last point. */
export interface Gesture {
  start: Pt;
  path: readonly Pt[];
  reason: 'commit' | 'cancel';
  /** A resize handle's index in `RESIZE_HANDLE_ANCHORS`. */
  handle?: number;
  opts?: BindingOpts;
}

/** The affordance a press on resize handle `i` reports. */
export function handleAffordance(i: number): { kind: string; anchor: unknown } {
  const h = RESIZE_HANDLE_ANCHORS[i % RESIZE_HANDLE_ANCHORS.length]!;
  return { kind: h.kind, anchor: h.anchor };
}

/** Run `g` through `action`'s ongoing invoker. Returns the handle, or null when the press was declined. */
export function drive(action: Action, deps: ActionDeps, g: Gesture): OngoingHandle | null {
  const inv = action.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error(`${action.id} is not ongoing`);
  const aff = g.handle === undefined ? undefined : handleAffordance(g.handle);
  const handle = inv.start(dragCtx(deps, g.start, g.start, aff), g.opts);
  if (!handle.onEnd && !handle.onMove) return null;
  for (const p of g.path) handle.onMove?.(dragCtx(deps, g.start, p, aff));
  handle.onEnd?.(dragCtx(deps, g.start, g.path.at(-1) ?? g.start, aff), g.reason);
  return handle;
}

/** Every finite number in `v`, recursively; throws on the first that is not. */
export function assertFinite(v: unknown, where: string): void {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`${where}: ${v}`);
    return;
  }
  if (v === null || typeof v !== 'object') return;
  for (const [k, x] of Object.entries(v)) assertFinite(x, `${where}.${k}`);
}

/** Every node's stored pose, by id. */
export function poses(scene: TestScene): Map<string, unknown> {
  return new Map([...scene.nodes.values()].map((n) => [n.id as string, n.pose]));
}
