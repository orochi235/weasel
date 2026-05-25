import { describe, it, expect, vi } from 'vitest';
import { setFillOpacityAction } from './setFillOpacity';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';

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
}): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: makeSelection(opts.selectionIds), scene: opts.scene },
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
});
