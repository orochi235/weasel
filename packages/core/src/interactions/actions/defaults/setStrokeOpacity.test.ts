import { describe, it, expect, vi } from 'vitest';
import { setStrokeOpacityAction } from './setStrokeOpacity';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { Stroke } from 'core/paint-types';
import { solid, strokeOf } from '../../../util/paint';
import { makeScene, makeCtx, ongoingInvoker } from './paintActionTestUtils';

const getInvoker = () => ongoingInvoker(setStrokeOpacityAction);

describe('setStrokeOpacityAction', () => {
  it('preserves the stroke, replaces its paint opacity on commit', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#aabbccff', 3) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set stroke opacity']);
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#aabbcc', opacity: 0.5 }, width: 3 });
  });

  it('clamps alpha01 to [0, 1]', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#aabbccff', 3) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 2 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 2 } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#aabbcc', opacity: 1 }, width: 3 });
  });

  it('returns empty handle when selection is empty', () => {
    const scene = makeScene({});
    const ctx = makeCtx({ selectionIds: [], scene, params: { alpha01: 0.5 } });
    expect(getInvoker().start(ctx, { params: { alpha01: 0.5 } })).toEqual({});
  });

  it('previewData carries the updated alpha during onMove', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#aabbccff', 3) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 1 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 1 } });
    h.onMove?.({ ...ctx, params: { alpha01: 0.25 } });
    expect((h.previewData?.('a' as unknown as NodeId) as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#aabbcc', opacity: 0.25 }, width: 3 });
  });

  it('cancel does not write', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#aabbccff', 3) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'cancel');
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('uses the kit default stroke when node.data.stroke is absent', () => {
    const scene = makeScene({ a: {} });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#000000', opacity: 0.5 }, width: 1 });
  });

  // -------------------------------------------------------------------------
  // Ops-based commit routed through the consumer `applyOps` hook
  // -------------------------------------------------------------------------

  it('routes the commit through the consumer applyOps hook once with setData ops + "Set stroke opacity" label', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#aabbccff', 3) }, b: { stroke: strokeOf('#11223344', 3) } });
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
    expect(label).toBe('Set stroke opacity');
    expect(ops).toHaveLength(2);
    for (const op of ops) expect(op.name).toBe('setData');
    const args0 = ops[0].args as { id: string; from: { stroke?: Stroke }; to: { stroke?: Stroke } };
    const args1 = ops[1].args as { id: string; from: { stroke?: Stroke }; to: { stroke?: Stroke } };
    expect(args0.id).toBe('a');
    expect(args1.id).toBe('b');
    // `from` is the pre-commit data; `to` carries the opacity-replaced stroke.
    expect(args0.from.stroke).toEqual(strokeOf('#aabbccff', 3));
    expect((args0.to as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#aabbcc', opacity: 0.5 }, width: 3 });
    expect(args1.from.stroke).toEqual({ paint: solid('#11223344'), width: 3 });
    expect((args1.to as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#112233', opacity: 0.5 }, width: 3 });
  });

  it('with no applyOps, falls back to one scene.applyBatch labeled "Set stroke opacity"', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#aabbccff', 3) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.applyBatch).toHaveBeenCalledOnce();
    expect(scene.batches).toEqual(['Set stroke opacity']);
    // The default adapter's setData routed back through scene.update.
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#aabbcc', opacity: 0.5 }, width: 3 });
  });
});
