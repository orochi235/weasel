/**
 * The warp actions. A warp tool binds the per-kind ones (`<kind>.drag`,
 * `puppet.addPin`, `puppet.removePin`) and owns them; `expandWarp` and
 * `configureWarp` work on whatever warp the selection holds and ship with
 * the `paths` preset.
 */
import {
  type Action, type ActionDeps, ActionDisabledReason, type BindingOpts, type ImmediateInvoker, type InvocationCtx, type OngoingHandle, resolveParams,
} from '@weasel-js/routing';
import { createEmitter } from '@weasel-js/registry';
import { applyToPoint, invert, type Point } from '@weasel-js/geom';
import { moveWarpControl, pathWarpMap, unwarpPoint, warpControls } from '@weasel-js/geom/warp';
import { commitOps, createSetDataOp, type Op, reshapeTo, selectedPathNodes, pathOperationTags } from '@weasel-js/core';
import { heldPathWarpOf, resolvePathWarp, withoutPathWarp } from './pathWarp';
import {
  storeWarp, WARP_LABELS, warpTargets, withWarpSettings, type WarpKind, type WarpSettings, type WarpTarget,
} from './warpTargets';
import { icon } from '../icons.gen';
import { warpSettingsForm } from './warpSettingsForm';

/** What a press on a warp control hands the drag that follows. */
export interface WarpHandleScratch {
  /** The warp the control belongs to, or null for one shown over a selection
   *  holding none yet, which the drag makes. */
  warpId: string | null;
  /** The control's index, as `warpControls` counts them. */
  index: number;
}

/** Nodes as an in-flight warp drag would leave them, for the chrome drawing
 *  the warp's controls to follow the drag rather than the scene. */
export interface WarpLive {
  get(id: string): { pose: unknown; data: unknown } | undefined;
  set(next: ReadonlyMap<string, { pose: unknown; data: unknown }> | null): void;
  subscribe(listener: () => void): () => void;
}

/** An empty {@link WarpLive}. */
export function createWarpLive(): WarpLive {
  let current: ReadonlyMap<string, { pose: unknown; data: unknown }> | null = null;
  const changed = createEmitter();
  return {
    get: (id) => current?.get(id),
    set: (next) => { current = next; changed.emit(); },
    subscribe: changed.subscribe,
  };
}

/** The scratch a control press carried, or null when the press was elsewhere. */
export function warpHandleScratchOf(hit: unknown): WarpHandleScratch | null {
  const payload = (hit as { payload?: unknown } | null | undefined)?.payload as Partial<WarpHandleScratch> | undefined;
  return payload && typeof payload.index === 'number' && payload.warpId !== undefined
    ? payload as WarpHandleScratch
    : null;
}

const REQUIRES: ('selection' | 'scene' | 'applyOps')[] = ['selection', 'scene', 'applyOps'];

function commitTargets(deps: ActionDeps, next: ReadonlyMap<string, { target: WarpTarget; shape: { pose: unknown; data: unknown } }>, label: string): void {
  const ops: Op[] = [];
  for (const { target, shape } of next.values()) ops.push(...reshapeTo(target.node.node, shape, label));
  commitOps(deps, ops, label);
}

/**
 * Drag one control of the selection's `kind` warp: a distort's corner, an
 * envelope's mesh point, a puppet's pin. Every selected path sharing that warp
 * follows the control. A press on the controls shown over a selection with no
 * warp of this kind yet makes one, from the binding's params
 * ({@link WarpSettings}), and the drag is its first edit. One undo step.
 */
export function createWarpDragAction(kind: WarpKind, live?: WarpLive): Action {
  const label = WARP_LABELS[kind];
  return {
    id: `${kind}.drag`,
    label: `${label} — drag control`,
    tags: pathOperationTags(kind === 'puppet' ? 'brush' : 'box'),
    requires: REQUIRES,
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
        const scratch = warpHandleScratchOf(ctx.drag?.affordance);
        if (!scratch) return {};
        const settings = (resolveParams(opts?.params) ?? {}) as WarpSettings;
        const targets = warpTargets(ctx.deps, kind, settings)
          .filter((t) => (scratch.warpId === null ? t.fresh : t.held.id === scratch.warpId));
        const first = targets[0];
        const control = first && warpControls(first.held.warp)[scratch.index];
        if (!control) return {};
        const deps = ctx.deps;
        const [cx, cy] = applyToPoint(first.toWorld, control.x, control.y);
        const press = ctx.drag?.start ?? ctx.world;
        let current = new Map<string, { target: WarpTarget; shape: { pose: unknown; data: unknown } }>();
        const publish = () => live?.set(new Map([...current].map(([id, e]) => [id, e.shape])));
        // Where the last move put the control: a move that leaves it there keeps the previews it made.
        let last: { x: number; y: number } | null = null;
        return {
          kind: `${kind}.drag`,
          onMove(m: InvocationCtx): void {
            const at = m.drag?.current ?? m.world;
            const world = { x: cx + at.x - press.x, y: cy + at.y - press.y };
            if (last !== null && last.x === world.x && last.y === world.y) return;
            last = world;
            current = new Map();
            for (const target of targets) {
              const back = invert(target.toWorld);
              if (!back) continue;
              const [lx, ly] = applyToPoint(back, world.x, world.y);
              const held = { ...target.held, warp: moveWarpControl(target.held.warp, scratch.index, { x: lx, y: ly }) };
              const shape = storeWarp(target.node.node, held, target.toWorld);
              if (shape) current.set(target.node.id, { target, shape });
            }
            publish();
          },
          onEnd(_end: InvocationCtx, reason: 'commit' | 'cancel'): void {
            const done = current;
            current = new Map();
            live?.set(null);
            if (reason === 'commit' && done.size > 0) commitTargets(deps, done, label);
          },
          previewIds: () => (current.size > 0 ? [...current.keys()] : null),
          previewPose: (id: string) => current.get(id)?.shape.pose ?? null,
          previewData: (id: string) => current.get(id)?.shape.data ?? null,
        };
      },
    },
  };
}

/** A click's world point: where the press landed. */
function clickPoint(params: Record<string, unknown> | undefined): Point | null {
  const x = (params?.pressX ?? params?.worldX) as number | undefined;
  const y = (params?.pressY ?? params?.worldY) as number | undefined;
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : null;
}

/**
 * Place a pin where the click landed on the selected paths, giving them a
 * puppet warp if they hold none. The pin goes where the shape is now: its
 * unwarped point is found by inverting the warp, so the shape keeps its
 * place until the pin is dragged.
 */
export function createAddPinAction(): Action {
  return {
    id: 'puppet.addPin',
    label: `${WARP_LABELS.puppet} — add pin`,
    tags: pathOperationTags('brush'),
    requires: REQUIRES,
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const at = clickPoint(params);
        if (!at) return;
        const next = new Map<string, { target: WarpTarget; shape: { pose: unknown; data: unknown } }>();
        for (const target of warpTargets(deps, 'puppet', (params ?? {}) as WarpSettings)) {
          const { warp } = target.held;
          const back = invert(target.toWorld);
          if (warp.kind !== 'puppet' || !back) continue;
          const [lx, ly] = applyToPoint(back, at.x, at.y);
          const to = { x: lx, y: ly };
          const from = unwarpPoint(pathWarpMap(warp, target.held.source), to);
          const held = { ...target.held, warp: { ...warp, pins: [...warp.pins, { from, to }] } };
          const shape = storeWarp(target.node.node, held, target.toWorld);
          if (shape) next.set(target.node.id, { target, shape });
        }
        commitTargets(deps, next, 'Add Pin');
      },
    } satisfies ImmediateInvoker,
    enabled: (deps) => (selectedPathNodes(deps).length > 0 ? true : ActionDisabledReason.SelectionRequired),
  };
}

/** Take out the pin the click landed on, from every path sharing its warp. */
export function createRemovePinAction(): Action {
  return {
    id: 'puppet.removePin',
    label: `${WARP_LABELS.puppet} — remove pin`,
    tags: pathOperationTags('brush'),
    requires: REQUIRES,
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const scratch = warpHandleScratchOf(params?.affordance);
        if (!scratch || scratch.warpId === null) return;
        const next = new Map<string, { target: WarpTarget; shape: { pose: unknown; data: unknown } }>();
        for (const target of warpTargets(deps, 'puppet', {})) {
          const { warp } = target.held;
          if (target.held.id !== scratch.warpId || warp.kind !== 'puppet') continue;
          const held = { ...target.held, warp: { ...warp, pins: warp.pins.filter((_, i) => i !== scratch.index) } };
          const shape = storeWarp(target.node.node, held, target.toWorld);
          if (shape) next.set(target.node.id, { target, shape });
        }
        commitTargets(deps, next, 'Remove Pin');
      },
    } satisfies ImmediateInvoker,
  };
}

/** Absorbs a press on a warp control, so the drag it grows into is the
 *  control's: an exclusive claim with nothing bound to the press drops it. */
export function createWarpGrabAction(kind: WarpKind): Action {
  return {
    id: `${kind}.grab`,
    label: `${WARP_LABELS[kind]} — grab control`,
    invoker: { timing: 'immediate', run: () => {} },
  };
}

/** Whether a selected path holds a warp: what both actions below work on. */
function holdsWarp(deps?: ActionDeps): true | ActionDisabledReason {
  return selectedPathNodes(deps ?? {}).some(({ node }) => heldPathWarpOf(node.data))
    ? true
    : ActionDisabledReason.NotApplicable;
}

/**
 * Drop the warp from each selected path, keeping the geometry it made: the
 * shape becomes plain geometry that path editing and other warps start from.
 */
export const expandWarpAction: Action = {
  id: 'expandWarp',
  label: 'Expand Warp',
  icon: icon('expand'),
  tags: pathOperationTags('command'),
  group: 'path',
  requires: REQUIRES,
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const ops: Op[] = [];
      for (const { node } of selectedPathNodes(deps)) {
        if (!heldPathWarpOf(node.data)) continue;
        ops.push(createSetDataOp({ id: node.id, from: node.data, to: withoutPathWarp(node.data), label: 'Expand Warp' }));
      }
      commitOps(deps, ops, 'Expand Warp');
    },
  } satisfies ImmediateInvoker,
  enabled: holdsWarp,
};

/**
 * Remake the selection's warps under new settings (`params`, a
 * {@link WarpSettings}, plus an optional `kind` limiting it to one kind of
 * warp): switch a distort between free and perspective, an envelope between
 * its mappings or to a finer grid, or refit at another tolerance. One undo
 * step. Its settings form shows what the selection holds.
 */
export const configureWarpAction: Action = {
  id: 'configureWarp',
  label: 'Warp Settings',
  icon: icon('core:tune'),
  tags: pathOperationTags('command'),
  group: 'path',
  requires: REQUIRES,
  settings: warpSettingsForm,
  enabled: holdsWarp,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const settings = (params ?? {}) as WarpSettings & { kind?: WarpKind };
      const next = new Map<string, { target: WarpTarget; shape: { pose: unknown; data: unknown } }>();
      for (const node of selectedPathNodes(deps)) {
        const resolved = resolvePathWarp(node.node);
        if (!resolved || (settings.kind && resolved.held.warp.kind !== settings.kind)) continue;
        const held = withWarpSettings(resolved.held, settings);
        if (held === resolved.held) continue;
        const shape = storeWarp(node.node, held, resolved.toWorld);
        if (shape) next.set(node.id, { target: { node, ...resolved, fresh: false }, shape });
      }
      commitTargets(deps, next, 'Warp Settings');
    },
  } satisfies ImmediateInvoker,
};
