import { vi } from 'vitest';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';

/**
 * The fake scene / selection / ctx trio the four paint-action suites run
 * against. `TData` is whichever slice of node data the action under test owns
 * — `{ fill }` or `{ stroke }`.
 */

interface FakeNode<TData> { id: NodeId; kind: 'leaf'; pose: unknown; data: TData }

/**
 * A scene recording what the action wrote.
 *
 * `applyBatch` mirrors the real one: it records a single undo entry and applies
 * each op through the supplied adapter. The actions pass `defaultCommitAdapter`,
 * whose `setData` calls `scene.update({ data })` — so every op routes back
 * through `update` here and populates `updates`.
 */
export function makeScene<TData extends object>(nodes: Record<string, TData>) {
  const current: Record<string, FakeNode<TData>> = {};
  for (const [id, d] of Object.entries(nodes)) {
    current[id] = { id: asNodeId(id), kind: 'leaf', pose: {}, data: { ...d } };
  }
  const updates: Array<{ id: string; data: unknown }> = [];
  const batches: string[] = [];
  return {
    get: (id: NodeId) => current[id as unknown as string] ?? null,
    update: vi.fn((id: NodeId, patch: { data: unknown }) => {
      updates.push({ id: id as unknown as string, data: patch.data });
      current[id as unknown as string].data = patch.data as never;
    }),
    setPose: vi.fn(),
    batch: vi.fn((label: string, fn: () => void) => { batches.push(label); fn(); }),
    applyBatch: vi.fn((opList: unknown[], label: string, adapter: unknown) => {
      batches.push(label);
      for (const op of opList as Array<{ apply(a: unknown): void }>) op.apply(adapter);
    }),
    renderOrder: () => Object.keys(current).map((id) => asNodeId(id)),
    updates,
    batches,
  };
}

export function makeSelection(ids: string[]) {
  return {
    get: () => ids.map(asNodeId),
    current: ids.map(asNodeId),
    set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  };
}

export function makeCtx(opts: {
  selectionIds: string[];
  scene: ReturnType<typeof makeScene>;
  params?: Record<string, unknown>;
  applyOps?: (ops: Op[], label: string) => void;
}): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: makeSelection(opts.selectionIds),
      scene: opts.scene,
      ...(opts.applyOps ? { applyOps: opts.applyOps } : {}),
    },
    params: opts.params,
  };
}

/** The action's ongoing invoker, narrowed — every paint action has one. */
export function ongoingInvoker(
  action: Action,
): { start: (ctx: InvocationCtx, opts?: BindingOpts) => OngoingHandle } {
  if (action.invoker?.timing !== 'ongoing') throw new Error('not ongoing');
  return action.invoker;
}
