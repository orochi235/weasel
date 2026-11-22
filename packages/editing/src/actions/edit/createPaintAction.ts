import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction, resolveParams } from '@weasel-js/routing';
import type { Scene, NodeId, Op } from '@weasel-js/core';
import { commitOps, inheritedPaintIn, paintInheritors } from '@weasel-js/core/engine';
import { INHERIT } from '@weasel-js/paint';
import { deepEqual, isFiniteNumber } from '@weasel-js/registry';
import * as coreOps from '@weasel-js/core/ops';
import { asNodeId, operandContent, requiresContent, withoutPageStructure } from '@weasel-js/core';

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
  /** Whether some run could change a node holding `prev`. The action is
   *  `NotApplicable` while no operand passes. Omitted, every node can change. */
  writable?(prev: TValue | null | undefined): boolean;
}

/** `v` when it is a finite number, else `fallback`: how a paint action reads a numeric param. */
export const finiteOr = <T>(v: unknown, fallback: T): number | T => (isFiniteNumber(v) ? v : fallback);

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

/** The nodes a paint action edits: the params' `ids` when given, else the selection's content. */
function targetsOf(deps: ActionDeps | undefined, params: Readonly<Record<string, unknown>> | undefined): readonly NodeId[] {
  const ids = explicitIds(params);
  if (ids === undefined) return operandContent(deps);
  const scene = deps?.scene;
  return scene ? withoutPageStructure(scene, ids.map(asNodeId)) : ids.map(asNodeId);
}

function explicitIds(params: Readonly<Record<string, unknown>> | undefined): readonly string[] | undefined {
  const ids = params?.ids;
  return Array.isArray(ids) ? (ids as readonly string[]) : undefined;
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

  /** What the run writes to `id`, or null when it leaves the node alone. An `'inherit'` node that would take the
   *  paint it already inherits is left alone too, so it goes on inheriting. */
  const writeFor = (scratch: Scratch<TState, TValue, K>, id: NodeId): { next: TValue | null } | null => {
    const base = scratch.bases.get(id);
    const next = spec.merge(base, scratch.state);
    return unchanged(scratch.startData.get(id)?.[spec.dataKey], next) || unchanged(base, next) ? null : { next };
  };

  const refreshPreviews = (scratch: Scratch<TState, TValue, K>): void => {
    scratch.previews.clear();
    for (const id of scratch.ids) {
      const write = writeFor(scratch, id);
      if (write) scratch.previews.set(id, { ...(scratch.startData.get(id) ?? {}), [spec.dataKey]: write.next } as Data);
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

        const fallback = resolveParams(opts?.params);
        type Targeted = { ids?: unknown } | undefined;
        const ids = [...targetsOf(ctx.deps, { ids: (ctx.params as Targeted)?.ids ?? (fallback as Targeted)?.ids })];
        if (ids.length === 0) return {};

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
              const write = writeFor(scratch, id);
              const nodeNow = scratch.scene.get(id);
              if (!nodeNow || !write) continue;
              const from = { ...(nodeNow.data as object) } as Data;
              const to = { ...from, [spec.dataKey]: write.next } as Data;
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
    enabled: (deps, _at, _carried, params) => {
      const given = explicitIds(params) !== undefined ? true : requiresContent(1)(deps);
      const scene = deps?.scene as Scene<Data, string, unknown> | undefined;
      if (given !== true || !spec.writable || !scene) return given;
      const ids = targetsOf(deps, params);
      return ids.some((id) => scene.get(id) && spec.writable!(baseOf(scene, id))) ? true : ActionDisabledReason.NotApplicable;
    },
  });
}
