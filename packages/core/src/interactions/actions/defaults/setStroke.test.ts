import { describe, it, expect, vi } from 'vitest';
import { setStrokeAction } from './setStroke';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { Stroke } from '@weasel-js/paint';
import { solid, strokeOf } from '../../../util/paint';
import { makeScene, makeSelection, makeCtx, ongoingInvoker } from './paintActionTestUtils';

const getInvoker = () => ongoingInvoker(setStrokeAction);

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
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    getInvoker().start(ctx, { params: { color: '#ff0000' } });
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('exposes the current color via previewData during the drag', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    const preview = h.previewData?.('a' as unknown as NodeId);
    expect(preview).toMatchObject({ stroke: { paint: { color: '#ff0000' }, width: 2 } });
  });

  it('onMove updates the preview color without touching scene', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    expect(h.previewData?.('a' as unknown as NodeId))
      .toMatchObject({ stroke: { paint: { color: '#00ff00' }, width: 2 } });
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('onEnd("commit") writes one scene.batch with the final color', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) }, b: { stroke: strokeOf('#ffffffff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a', 'b'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set stroke']);
    expect(scene.updates).toHaveLength(2);
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#00ff00' }, width: 2 });
    expect((scene.updates[1].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#00ff00' }, width: 2 });
  });

  it('onEnd("cancel") does not write to scene', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'cancel');
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.update).not.toHaveBeenCalled();
  });

  it("adopts the stroke paint's existing opacity when a 6-char color is supplied", () => {
    const scene = makeScene({ a: { stroke: strokeOf('#11223380', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#ff0000', opacity: solid('#11223380').opacity }, width: 2 });
  });

  it('uses supplied alpha when an 8-char color is provided', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#11223380', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff000040' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff000040' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: solid('#ff000040'), width: 2 });
  });

  it('keeps width, cap and dash when only the color changes', () => {
    const dashed: Stroke = { paint: solid('#000000ff'), width: 7, cap: 'round', dash: [2, 2] };
    const scene = makeScene({ a: { stroke: dashed } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ ...dashed, paint: { color: '#ff0000' } });
  });

  it('gives a node with no stroke a hairline one', () => {
    const scene = makeScene({ a: {} });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#ff0000' }, width: 1 });
  });

  // -------------------------------------------------------------------------
  // Ops-based commit routed through the consumer `applyOps` hook
  // -------------------------------------------------------------------------

  it('routes the commit through the consumer applyOps hook once with setData ops + "Set stroke" label', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) }, b: { stroke: strokeOf('#ffffffff', 2) } });
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
    const args0 = ops[0].args as { id: string; from: { stroke?: Stroke }; to: { stroke?: Stroke } };
    const args1 = ops[1].args as { id: string; from: { stroke?: Stroke }; to: { stroke?: Stroke } };
    expect(args0.id).toBe('a');
    expect(args1.id).toBe('b');
    // `from` is the pre-commit data; `to` carries the recolored final stroke.
    expect(args0.from.stroke).toEqual(strokeOf('#000000ff', 2));
    expect((args0.to as { stroke: Stroke }).stroke).toEqual({ paint: { color: '#00ff00' }, width: 2 });
    expect(args1.from.stroke).toEqual(strokeOf('#ffffffff', 2));
    expect((args1.to as { stroke: Stroke }).stroke).toEqual({ paint: { color: '#00ff00' }, width: 2 });
  });

  it('with no applyOps, falls back to one scene.applyBatch labeled "Set stroke"', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.applyBatch).toHaveBeenCalledOnce();
    expect(scene.batches).toEqual(['Set stroke']);
    // The default adapter's setData routed back through scene.update.
    expect((scene.updates[0].data as { stroke: Stroke }).stroke)
      .toEqual({ paint: { color: '#ff0000' }, width: 2 });
  });
});

describe('setStrokeAction — non-solid paints', () => {
  const GRADIENT = {
    fill: 'linear-gradient' as const,
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    units: 'local' as const,
  };

  it('writes a paint verbatim rather than folding an opacity into it', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#ffffff80', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { paint: GRADIENT } });
    const h = getInvoker().start(ctx);
    h.onEnd!(ctx, 'commit');
    expect(scene.updates[0].data).toMatchObject({ stroke: { paint: GRADIENT, width: 2 } });
  });

  it('previews a paint during the gesture without writing to the scene', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { paint: GRADIENT } });
    const h = getInvoker().start(ctx);
    expect(h.previewData!('a')).toMatchObject({ stroke: { paint: GRADIENT, width: 2 } });
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('follows a paint edited mid-gesture, so a stop drag previews live', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { paint: GRADIENT } });
    const h = getInvoker().start(ctx);
    const moved = { ...GRADIENT, to: { x: 99, y: 0 } };
    h.onMove!({ ...ctx, params: { paint: moved } });
    expect(h.previewData!('a')).toMatchObject({ stroke: { paint: moved, width: 2 } });
    h.onEnd!(ctx, 'commit');
    expect(scene.updates[0].data).toMatchObject({ stroke: { paint: moved, width: 2 } });
  });

  it('commits one batch for a paint, as for a color', () => {
    const scene = makeScene({
      a: { stroke: strokeOf('#000000ff', 2) },
      b: { stroke: strokeOf('#ffffffff', 2) },
    });
    const ctx = makeCtx({ selectionIds: ['a', 'b'], scene, params: { paint: GRADIENT } });
    const h = getInvoker().start(ctx);
    h.onEnd!(ctx, 'commit');
    expect(scene.batches).toEqual(['Set stroke']);
  });

  it('lets a later color supersede a paint, so the picker still works after a gradient', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 2) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { paint: GRADIENT } });
    const h = getInvoker().start(ctx);
    h.onMove!({ ...ctx, params: { color: '#ff0000' } });
    h.onEnd!(ctx, 'commit');
    expect(scene.updates[0].data).toMatchObject({ stroke: { paint: { color: '#ff0000' }, width: 2 } });
  });

  it('replaces a gradient outright when a color is picked over one', () => {
    const scene = makeScene({ a: { stroke: { paint: GRADIENT, width: 2 } } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx);
    h.onEnd!(ctx, 'commit');
    expect(scene.updates[0].data).toMatchObject({ stroke: { paint: { color: '#ff0000' }, width: 2 } });
  });

  it('seeds a width when a paint lands on a node with no stroke', () => {
    const scene = makeScene({ a: {} });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { paint: GRADIENT } });
    const h = getInvoker().start(ctx);
    h.onEnd!(ctx, 'commit');
    expect(scene.updates[0].data).toEqual({ stroke: { paint: GRADIENT, width: 1 } });
  });
});
