import { describe, it, expect, vi } from 'vitest';
import { setFillAction } from './setFill';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';

interface FakeNode { id: NodeId; kind: 'leaf'; pose: unknown; data: { fill?: string; stroke?: string } }

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
  if (setFillAction.invoker?.timing !== 'ongoing') throw new Error('not ongoing');
  return setFillAction.invoker;
}

describe('setFillAction', () => {
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
    const scene = makeScene({ a: { fill: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    getInvoker().start(ctx, { params: { color: '#ff0000' } });
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('exposes the current color via previewData during the drag', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    const preview = h.previewData?.('a' as unknown as NodeId);
    expect(preview).toMatchObject({ fill: '#ff0000ff' });
  });

  it('onMove updates the preview color without touching scene', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    expect(h.previewData?.('a' as unknown as NodeId)).toMatchObject({ fill: '#00ff00ff' });
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('onEnd("commit") writes one scene.batch with the final color', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' }, b: { fill: '#000000ff' } });
    const ctx = makeCtx({ selectionIds: ['a', 'b'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set fill']);
    expect(scene.updates).toHaveLength(2);
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#00ff00ff');
    expect((scene.updates[1].data as { fill: string }).fill).toBe('#00ff00ff');
  });

  it('onEnd("cancel") does not write to scene', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'cancel');
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('preserves existing alpha when a 6-char color is supplied', () => {
    const scene = makeScene({ a: { fill: '#11223380' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#ff000080');
  });

  it('uses supplied alpha when an 8-char color is provided', () => {
    const scene = makeScene({ a: { fill: '#11223380' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff000040' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff000040' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#ff000040');
  });
});
