import type { Action, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction, resolveParams } from '@weasel-js/routing';
import type { Scene, NodeId, Op } from '@weasel-js/core';
import { commitOps, inheritedPaintIn, paintInheritors } from '@weasel-js/core/engine';
import { INHERIT } from '@weasel-js/paint';
import { deepEqual } from '@weasel-js/registry';
import * as coreOps from '@weasel-js/core/ops';

/** The node data one paint action reads and writes: its own key, nothing else. */
type PaintData<K extends string, TValue> = { [P in K]?: TValue | null };

/** Read a param from the invocation, falling back to the binding's. */
export type PickParam<P> = <Key extends keyof P>(key: Key) => P[Key] | undefined;

/**
 * What distinguishes one paint action from another.
 *
 * `TState` is the action's gesture state. It is a reducer, not a paint:
 * `setFill` and `setStroke` supersede a paint with a later color, which no
 * per-field merge of the params can express.
 */
export interface PaintActionSpec<TState, TValue, K extends string, P> {
  id: string;
  label: string;
  /** The `data` key this action owns. */
  dataKey: K;
  /** Gesture state at start. */
  initialState(pick: PickParam<P>): TState;
  /** The state one onMove tick moves to, or `null` when its params carry
   *  nothing this action reads — the preview then stands. */
  readParams(prev: TState, params: Readonly<Partial<P>> | undefined): TState | null;
  /** The value to write for one node, from that node's value at gesture start —
   *  for an `'inherit'` fill or stroke, the paint it inherits, so a write takes
   *  that paint over rather than the string. `null` writes the absence of paint, which is a value like any other —
   *  a node with `fill: null` paints no fill. Handing back `prev`, or a value
   *  equal to it, leaves the node out of the preview and the commit. */
  merge(prev: TValue | null | undefined, state: TState): TValue | null;
}

/** Whether `merge` handed back the value it was given, or one equal to it: nothing to write. */
const unchanged = (prev: unknown, next: unknown): boolean =>
  (next === null && prev === undefined) || deepEqual(prev, next, { undefinedAsAbsent: true });

interface Scratch<TState, TValue, K extends string> {
  ids: NodeId[];
  scene: Scene<PaintData<K, TValue>, string, unknown>;
  /** Data snapshot at gesture start, keyed by node id. */
  startData: Map<NodeId, PaintData<K, TValue>>;
  /** What `merge` starts from per node: its value at gesture start, `'inherit'` resolved. */
  bases: Map<NodeId, TValue | null | undefined>;
  state: TState;
  /** Preview data entries — the merged value per selected node. */
  previews: Map<NodeId, PaintData<K, TValue>>;
}

/**
 * The ongoing-action body the paint actions share: it previews without
 * touching the scene, and commits one batch (one undo entry) through
 * `commitOps`.
 *
 * The `from` data is re-read at commit rather than reused from the start
 * snapshot, so a concurrent edit to a field this action does not own is not
 * clobbered.
 */
export function createPaintAction<TState, TValue, K extends string, P>(
  spec: PaintActionSpec<TState, TValue, K, P>,
): Action {
  type Data = PaintData<K, TValue>;

  const refreshPreviews = (scratch: Scratch<TState, TValue, K>): void => {
    scratch.previews.clear();
    for (const id of scratch.ids) {
      const prev = scratch.startData.get(id);
      const next = spec.merge(scratch.bases.get(id), scratch.state);
      if (!unchanged(prev?.[spec.dataKey], next)) scratch.previews.set(id, { ...(prev ?? {}), [spec.dataKey]: next } as Data);
    }
  };

  const baseOf = (scene: Scene<Data, string, unknown>, id: NodeId): TValue | null | undefined => {
    const node = scene.get(id);
    const own = (node?.data as Data | undefined)?.[spec.dataKey];
    if ((own as unknown) !== INHERIT || !node) return own;
    const key = spec.dataKey as string;
    if (key !== 'fill' && key !== 'stroke') return own;
    return (inheritedPaintIn(scene as never, node as never)?.[key] ?? null) as TValue | null;
  };

  return defineAction<string, P>({
    id: spec.id,
    label: spec.label,
    eligible: { capability: 'applies-fill' },
    requires: ['operands', 'scene', 'applyOps'],
    invoker: {
      timing: 'ongoing',
      start(ctx, opts) {
        const selection = ctx.deps.operands;
        const scene = ctx.deps.scene as Scene<Data, string, unknown> | undefined;

        if (!selection || !scene) return {};

        const ids = selection.get() as NodeId[];
        if (ids.length === 0) return {};

        const fallback = resolveParams(opts?.params);
        // `??` would lose a `paint: null`, which is None, not "no paint given".
        const pick: PickParam<P> = (key) => (ctx.params?.[key] !== undefined ? ctx.params[key] : fallback?.[key]);

        const startData = new Map<NodeId, Data>();
        const bases = new Map<NodeId, TValue | null | undefined>();
        for (const id of ids) {
          const node = scene.get(id);
          if (!node) continue;
          startData.set(id, { ...(node.data as Data) });
          bases.set(id, baseOf(scene, id));
        }

        const scratch: Scratch<TState, TValue, K> = {
          ids,
          scene,
          startData,
          bases,
          state: spec.initialState(pick),
          previews: new Map(),
        };
        refreshPreviews(scratch);
        // Members that inherit the paint being changed preview with it.
        const key = spec.dataKey as string;
        const inheritors = key === 'fill' || key === 'stroke'
          ? [...new Set(ids.flatMap((id) => paintInheritors(scene, id, key)))].filter((id) => !startData.has(id as NodeId))
          : [];

        return {
          onMove(moveCtx: InvocationCtx<P>): void {
            const next = spec.readParams(scratch.state, moveCtx.params);
            if (next === null) return;
            scratch.state = next;
            refreshPreviews(scratch);
          },
          onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            if (reason === 'cancel') {
              scratch.previews.clear();
              return;
            }
            const ops: Op[] = [];
            for (const id of scratch.ids) {
              const start = scratch.startData.get(id)?.[spec.dataKey];
              const merged = spec.merge(scratch.bases.get(id), scratch.state);
              const nodeNow = scratch.scene.get(id);
              if (!nodeNow || unchanged(start, merged)) continue;
              const from = { ...(nodeNow.data as object) } as Data;
              const to = { ...from, [spec.dataKey]: merged } as Data;
              ops.push(coreOps.setData<Data>({ id: id as string, from, to }));
            }
            commitOps(ctx.deps, ops, spec.label);
            scratch.previews.clear();
          },
          previewIds: () => (scratch.previews.size === 0 ? [] : [...scratch.previews.keys(), ...inheritors]),
          previewData: (id: string) => scratch.previews.get(id as unknown as NodeId) ?? null,
        };
      },
    },
    enabled: (deps) => {
      const sel = deps?.operands;
      if (!sel || (sel.get() as unknown[]).length === 0) {
        return ActionDisabledReason.SelectionRequired;
      }
      return true;
    },
  });
}
