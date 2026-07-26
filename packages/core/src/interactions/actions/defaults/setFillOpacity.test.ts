import { describe, it, expect, vi } from 'vitest';
import { setFillOpacityAction } from './setFillOpacity';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';

interface FakeNode { id: NodeId; kind: 'leaf'; pose: unknown; data: { fill?: string } }

function makeScene(nodes: Record<string, { fill?: string }>) {
  const current: Record<string, FakeNode> = {};
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
    // Mirror the real scene: applyBatch records one undo entry and applies each
    // op through the supplied adapter. The action passes `defaultCommitAdapter`,
    // whose `setData` calls `scene.update({ data })` — so each op routes back
    // through `update` above, populating `updates`.
    applyBatch: vi.fn((opList: unknown[], label: string, adapter: unknown) => {
      batches.push(label);
      for (const op of opList as Array<{ apply(a: unknown): void }>) op.apply(adapter);
    }),
    renderOrder: () => Object.keys(current).map((id) => asNodeId(id)),
    updates,
    batches,
  };
}

function makeSelection(ids: string[]) {
  return {
    get: () => ids.map(asNodeId),
    current: ids.map(asNodeId),
    set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  };
}

function makeCtx(opts: {
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

function getInvoker(): { start: (ctx: InvocationCtx, opts?: BindingOpts) => OngoingHandle } {
  if (setFillOpacityAction.invoker?.timing !== 'ongoing') throw new Error('not ongoing');
  return setFillOpacityAction.invoker;
}

describe('setFillOpacityAction', () => {
  it('preserves RGB, replaces alpha on commit', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set fill opacity']);
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#aabbcc80');
  });

  it('clamps alpha01 to [0, 1]', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 2 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 2 } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#aabbccff');
  });

  it('returns empty handle when selection is empty', () => {
    const scene = makeScene({});
    const ctx = makeCtx({ selectionIds: [], scene, params: { alpha01: 0.5 } });
    expect(getInvoker().start(ctx, { params: { alpha01: 0.5 } })).toEqual({});
  });

  it('previewData carries the updated alpha during onMove', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 1 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 1 } });
    h.onMove?.({ ...ctx, params: { alpha01: 0.25 } });
    expect((h.previewData?.('a' as unknown as NodeId) as { fill: string }).fill).toBe('#aabbcc40');
  });

  it('cancel does not write', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'cancel');
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('uses node default fill (#ffffffff) when node.data.fill is absent', () => {
    const scene = makeScene({ a: {} });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#ffffff80');
  });

  // -------------------------------------------------------------------------
  // Ops-based commit routed through the consumer `applyOps` hook
  // -------------------------------------------------------------------------

  it('routes the commit through the consumer applyOps hook once with setData ops + "Set fill opacity" label', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' }, b: { fill: '#11223344' } });
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();
    const ctx = makeCtx({ selectionIds: ['a', 'b'], scene, params: { alpha01: 1 }, applyOps });
    const h = getInvoker().start(ctx, { params: { alpha01: 1 } });
    h.onMove?.({ ...ctx, params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');

    // Consumer hook owns the commit — scene.applyBatch / direct update are not used.
    expect(applyOps).toHaveBeenCalledOnce();
    expect(scene.updates).toHaveLength(0);
    expect(scene.batches).toHaveLength(0);

    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Set fill opacity');
    expect(ops).toHaveLength(2);
    for (const op of ops) expect(op.name).toBe('setData');
    const args0 = ops[0].args as { id: string; from: { fill?: string }; to: { fill?: string } };
    const args1 = ops[1].args as { id: string; from: { fill?: string }; to: { fill?: string } };
    expect(args0.id).toBe('a');
    expect(args1.id).toBe('b');
    // `from` is the pre-commit data; `to` carries the alpha-replaced fill.
    expect(args0.from.fill).toBe('#aabbccff');
    expect((args0.to as { fill: string }).fill).toBe('#aabbcc80');
    expect(args1.from.fill).toBe('#11223344');
    expect((args1.to as { fill: string }).fill).toBe('#11223380');
  });

  it('with no applyOps, falls back to one scene.applyBatch labeled "Set fill opacity"', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.applyBatch).toHaveBeenCalledOnce();
    expect(scene.batches).toEqual(['Set fill opacity']);
    // The default adapter's setData routed back through scene.update.
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#aabbcc80');
  });
});
