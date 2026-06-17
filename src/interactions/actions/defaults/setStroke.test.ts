import { describe, it, expect, vi } from 'vitest';
import { setStrokeAction } from './setStroke';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';

interface FakeNode { id: NodeId; kind: 'leaf'; pose: unknown; data: { fill?: string; stroke?: string } }

function makeScene(nodes: Record<string, { stroke?: string }>) {
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
  if (setStrokeAction.invoker?.timing !== 'ongoing') throw new Error('not ongoing');
  return setStrokeAction.invoker;
}

describe('setStrokeAction', () => {
  it('returns an empty handle when selection is empty', () => {
    const scene = makeScene({});
    const ctx = makeCtx({ selectionIds: [], scene });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    expect(h).toEqual({});
  });

  it('returns an empty handle when scene is missing', () => {
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: makeSelection(['a']) },
      params: { color: '#ff0000' },
    };
    const h = getInvoker().start(ctx, undefined);
    expect(h).toEqual({});
  });

  it('does not write to scene on start', () => {
    const scene = makeScene({ a: { stroke: '#000000ff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    getInvoker().start(ctx, { params: { color: '#ff0000' } });
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('exposes the current color via previewData during the drag', () => {
    const scene = makeScene({ a: { stroke: '#000000ff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    const preview = h.previewData?.('a' as unknown as NodeId);
    expect(preview).toMatchObject({ stroke: '#ff0000ff' });
  });

  it('onMove updates the preview color without touching scene', () => {
    const scene = makeScene({ a: { stroke: '#000000ff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    expect(h.previewData?.('a' as unknown as NodeId)).toMatchObject({ stroke: '#00ff00ff' });
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('onEnd("commit") writes one scene.batch with the final color', () => {
    const scene = makeScene({ a: { stroke: '#000000ff' }, b: { stroke: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a', 'b'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set stroke']);
    expect(scene.updates).toHaveLength(2);
    expect((scene.updates[0].data as { stroke: string }).stroke).toBe('#00ff00ff');
    expect((scene.updates[1].data as { stroke: string }).stroke).toBe('#00ff00ff');
  });

  it('onEnd("cancel") does not write to scene', () => {
    const scene = makeScene({ a: { stroke: '#000000ff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'cancel');
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('preserves existing alpha when a 6-char color is supplied', () => {
    const scene = makeScene({ a: { stroke: '#11223380' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { stroke: string }).stroke).toBe('#ff000080');
  });

  it('uses supplied alpha when an 8-char color is provided', () => {
    const scene = makeScene({ a: { stroke: '#11223380' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff000040' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff000040' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { stroke: string }).stroke).toBe('#ff000040');
  });

  // -------------------------------------------------------------------------
  // Ops-based commit routed through the consumer `applyOps` hook
  // -------------------------------------------------------------------------

  it('routes the commit through the consumer applyOps hook once with setData ops + "Set stroke" label', () => {
    const scene = makeScene({ a: { stroke: '#000000ff' }, b: { stroke: '#ffffffff' } });
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();
    const ctx = makeCtx({ selectionIds: ['a', 'b'], scene, params: { color: '#ff0000' }, applyOps });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    h.onEnd?.(ctx, 'commit');

    // Consumer hook owns the commit — scene.applyBatch / direct update are not used.
    expect(applyOps).toHaveBeenCalledOnce();
    expect(scene.updates).toHaveLength(0);
    expect(scene.batches).toHaveLength(0);

    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Set stroke');
    expect(ops).toHaveLength(2);
    for (const op of ops) expect(op.name).toBe('setData');
    const args0 = ops[0].args as { id: string; from: { stroke?: string }; to: { stroke?: string } };
    const args1 = ops[1].args as { id: string; from: { stroke?: string }; to: { stroke?: string } };
    expect(args0.id).toBe('a');
    expect(args1.id).toBe('b');
    // `from` is the pre-commit data; `to` carries the merged final stroke.
    expect(args0.from.stroke).toBe('#000000ff');
    expect((args0.to as { stroke: string }).stroke).toBe('#00ff00ff');
    expect(args1.from.stroke).toBe('#ffffffff');
    expect((args1.to as { stroke: string }).stroke).toBe('#00ff00ff');
  });

  it('with no applyOps, falls back to one scene.applyBatch labeled "Set stroke"', () => {
    const scene = makeScene({ a: { stroke: '#000000ff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.applyBatch).toHaveBeenCalledOnce();
    expect(scene.batches).toEqual(['Set stroke']);
    // The default adapter's setData routed back through scene.update.
    expect((scene.updates[0].data as { stroke: string }).stroke).toBe('#ff0000ff');
  });
});
