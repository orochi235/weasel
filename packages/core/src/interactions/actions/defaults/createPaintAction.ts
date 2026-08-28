import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { ActionDisabledReason } from '../registry';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import { createSetDataOp } from 'core/ops/setData';
import { defaultCommitAdapter } from '../defaultCommitAdapter';

/** The node data one paint action reads and writes: its own key, nothing else. */
type PaintData<K extends string, TValue> = { [P in K]?: TValue | null };

type Params = Record<string, unknown> | undefined;

/** Read a param from the invocation, falling back to the binding's. */
export type PickParam = <T>(key: string) => T | undefined;

/**
 * What distinguishes one paint action from the other three.
 *
 * `TState` is the action's gesture state — a color plus an optional paint for
 * the two setters, a bare alpha for the two opacity actions. It is a reducer,
 * not a paint: `setFill` and `setStroke` supersede a paint with a later color,
 * which no per-field merge of the params can express.
 */
export interface PaintActionSpec<TState, TValue, K extends string> {
  id: string;
  label: string;
  /** The `data` key this action owns. */
  dataKey: K;
  /** Gesture state at start. */
  initialState(pick: PickParam): TState;
  /** The state one onMove tick moves to, or `null` when its params carry
   *  nothing this action reads — the preview then stands. */
  readParams(prev: TState, params: Params): TState | null;
  /** The value to write for one node, from that node's value at gesture start. */
  merge(prev: TValue | null | undefined, state: TState): TValue;
}

interface Scratch<TState, TValue, K extends string> {
  ids: NodeId[];
  scene: Scene<PaintData<K, TValue>, string, unknown>;
  /** Data snapshot at gesture start, keyed by node id. */
  startData: Map<NodeId, PaintData<K, TValue>>;
  state: TState;
  /** Preview data entries — the merged value per selected node. Populated on
   *  start and refreshed on every onMove. */
  previews: Map<NodeId, PaintData<K, TValue>>;
  /** Optional consumer commit hook captured at gesture start. When present,
   *  the ops-based commit routes through it (consumer history) instead of
   *  `scene.applyBatch`. Undefined → fall back to `scene.applyBatch`. */
  applyOps?: (ops: Op[], label: string) => void;
}

/**
 * The one ongoing-action body the four paint actions share.
 *
 * On start it captures each selected node's data; on each onMove it refreshes
 * the preview without touching the scene; on commit it emits one
 * `createSetDataOp` per node (from = pre-commit data, to = the same data with
 * the merged value) and routes the batch through the consumer `applyOps` hook
 * when present (consumer history) else `scene.applyBatch` +
 * `defaultCommitAdapter` (whose `setData` delegates to `scene.update({ data })`).
 * Either path is a single batch → one undo entry.
 *
 * The `from` data is re-read at commit rather than reused from the start
 * snapshot, so a concurrent edit to a field this action does not own is not
 * clobbered.
 */
export function createPaintAction<TState, TValue, K extends string>(
  spec: PaintActionSpec<TState, TValue, K>,
): Action & { requires: string[] } {
  type Data = PaintData<K, TValue>;

  const refreshPreviews = (scratch: Scratch<TState, TValue, K>): void => {
    scratch.previews.clear();
    for (const id of scratch.ids) {
      const prev = scratch.startData.get(id);
      const next = spec.merge(prev?.[spec.dataKey], scratch.state);
      scratch.previews.set(id, { ...(prev ?? {}), [spec.dataKey]: next } as Data);
    }
  };

  return {
    id: spec.id,
    label: spec.label,
    eligible: { capability: 'applies-fill' },
    requires: ['selection', 'scene', 'applyOps'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
        const selection = ctx.deps.selection as SelectionApi | undefined;
        const scene = ctx.deps.scene as Scene<Data, string, unknown> | undefined;
        const applyOps = ctx.deps.applyOps as ((ops: Op[], label: string) => void) | undefined;

        if (!selection || !scene) return {};

        const ids = selection.get() as NodeId[];
        if (ids.length === 0) return {};

        const fallback = opts?.params as Params;
        const pick = (<T>(key: string) =>
          (ctx.params?.[key] ?? fallback?.[key]) as T | undefined) as PickParam;

        const startData = new Map<NodeId, Data>();
        for (const id of ids) {
          const node = scene.get(id);
          if (node) startData.set(id, { ...(node.data as Data) });
        }

        const scratch: Scratch<TState, TValue, K> = {
          ids,
          scene,
          startData,
          state: spec.initialState(pick),
          previews: new Map(),
          applyOps,
        };
        refreshPreviews(scratch);

        return {
          onMove(moveCtx: InvocationCtx): void {
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
              const merged = spec.merge(
                scratch.startData.get(id)?.[spec.dataKey],
                scratch.state,
              );
              const nodeNow = scratch.scene.get(id);
              if (!nodeNow) continue;
              const from = { ...(nodeNow.data as object) } as Data;
              const to = { ...from, [spec.dataKey]: merged } as Data;
              ops.push(createSetDataOp<Data>({ id: id as string, from, to }));
            }
            if (ops.length > 0) {
              if (scratch.applyOps) scratch.applyOps(ops, spec.label);
              else scratch.scene.applyBatch(ops, spec.label, defaultCommitAdapter(scratch.scene));
            }
            scratch.previews.clear();
          },
          previewIds: () => scratch.previews.keys(),
          previewData: (id: string) => scratch.previews.get(id as unknown as NodeId) ?? null,
        };
      },
    },
    enabled: (deps) => {
      const sel = deps?.selection as SelectionApi | undefined;
      if (!sel || (sel.get() as unknown[]).length === 0) {
        return ActionDisabledReason.SelectionRequired;
      }
      return true;
    },
  };
}
