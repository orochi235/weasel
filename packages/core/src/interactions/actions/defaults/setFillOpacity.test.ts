import { describe, it, expect, vi } from 'vitest';
import { setFillOpacityAction } from './setFillOpacity';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { FillStyle } from '@weasel-js/paint';
import { solid } from '../../../util/paint';
import { makeScene, makeCtx, ongoingInvoker } from './paintActionTestUtils';

const getInvoker = () => ongoingInvoker(setFillOpacityAction);

describe('setFillOpacityAction', () => {
  it('preserves the paint, replaces its opacity on commit', () => {
    const scene = makeScene({ a: { fill: solid('#aabbccff') } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set fill opacity']);
    expect((scene.updates[0].data as { fill: FillStyle }).fill)
      .toEqual({ color: '#aabbcc', opacity: 0.5 });
  });

  it('clamps alpha01 to [0, 1]', () => {
    const scene = makeScene({ a: { fill: solid('#aabbccff') } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 2 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 2 } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: FillStyle }).fill)
      .toEqual({ color: '#aabbcc', opacity: 1 });
  });

  it('returns empty handle when selection is empty', () => {
    const scene = makeScene({});
    const ctx = makeCtx({ selectionIds: [], scene, params: { alpha01: 0.5 } });
    expect(getInvoker().start(ctx, { params: { alpha01: 0.5 } })).toEqual({});
  });

  it('previewData carries the updated alpha during onMove', () => {
    const scene = makeScene({ a: { fill: solid('#aabbccff') } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 1 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 1 } });
    h.onMove?.({ ...ctx, params: { alpha01: 0.25 } });
    expect((h.previewData?.('a' as unknown as NodeId) as { fill: FillStyle }).fill)
      .toEqual({ color: '#aabbcc', opacity: 0.25 });
  });

  it('cancel does not write', () => {
    const scene = makeScene({ a: { fill: solid('#aabbccff') } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'cancel');
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('uses the kit default fill when node.data.fill is absent', () => {
    const scene = makeScene({ a: {} });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: FillStyle }).fill)
      .toEqual({ color: '#ffffff', opacity: 0.5 });
  });

  // -------------------------------------------------------------------------
  // Ops-based commit routed through the consumer `applyOps` hook
  // -------------------------------------------------------------------------

  it('routes the commit through the consumer applyOps hook once with setData ops + "Set fill opacity" label', () => {
    const scene = makeScene({ a: { fill: solid('#aabbccff') }, b: { fill: solid('#11223344') } });
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
    const args0 = ops[0].args as { id: string; from: { fill?: FillStyle }; to: { fill?: FillStyle } };
    const args1 = ops[1].args as { id: string; from: { fill?: FillStyle }; to: { fill?: FillStyle } };
    expect(args0.id).toBe('a');
    expect(args1.id).toBe('b');
    // `from` is the pre-commit data; `to` carries the opacity-replaced fill.
    expect(args0.from.fill).toEqual({ color: '#aabbcc' });
    expect((args0.to as { fill: FillStyle }).fill).toEqual({ color: '#aabbcc', opacity: 0.5 });
    expect(args1.from.fill).toEqual(solid('#11223344'));
    expect((args1.to as { fill: FillStyle }).fill).toEqual({ color: '#112233', opacity: 0.5 });
  });

  it('with no applyOps, falls back to one scene.applyBatch labeled "Set fill opacity"', () => {
    const scene = makeScene({ a: { fill: solid('#aabbccff') } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.applyBatch).toHaveBeenCalledOnce();
    expect(scene.batches).toEqual(['Set fill opacity']);
    // The default adapter's setData routed back through scene.update.
    expect((scene.updates[0].data as { fill: FillStyle }).fill)
      .toEqual({ color: '#aabbcc', opacity: 0.5 });
  });
});
