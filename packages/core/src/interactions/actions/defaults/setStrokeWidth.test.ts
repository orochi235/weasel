import { describe, it, expect } from 'vitest';
import { setStrokeWidthAction } from './setStrokeWidth';
import type { NodeId } from 'core/scene/types';
import type { Stroke } from '@weasel-js/paint';
import { strokeOf } from '../../../util/paint';
import { makeScene, makeCtx, ongoingInvoker } from './paintActionTestUtils';

const getInvoker = () => ongoingInvoker(setStrokeWidthAction);
const strokeAfter = (scene: ReturnType<typeof makeScene>) => (scene.updates[0]!.data as { stroke: Stroke }).stroke;

describe('setStrokeWidthAction', () => {
  it('sets the width and keeps the paint, as one undo entry', () => {
    const scene = makeScene({ a: { stroke: { ...strokeOf('#aabbccff', 3), cap: 'round' } } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { width: 8 } });
    getInvoker().start(ctx, { params: { width: 8 } }).onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set stroke width']);
    expect(strokeAfter(scene)).toEqual({ paint: { color: '#aabbcc' }, width: 8, cap: 'round' });
  });

  it('writes per-anchor widths, and takes them off with null', () => {
    const tapered = { ...strokeOf('#000000ff', 2), vertexWidths: [1, 6, 1] };
    const scene = makeScene({ a: { stroke: tapered } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { vertexWidths: [2, 9, 2] } });
    getInvoker().start(ctx, { params: { vertexWidths: [2, 9, 2] } }).onEnd?.(ctx, 'commit');
    expect(strokeAfter(scene).vertexWidths).toEqual([2, 9, 2]);
    expect(strokeAfter(scene).width).toBe(2);

    const cleared = makeScene({ a: { stroke: tapered } });
    const off = makeCtx({ selectionIds: ['a'], scene: cleared, params: { vertexWidths: null } });
    getInvoker().start(off, { params: { vertexWidths: null } }).onEnd?.(off, 'commit');
    expect(strokeAfter(cleared)).not.toHaveProperty('vertexWidths');
  });

  it('previews each tick of a drag and commits the last', () => {
    const scene = makeScene({ a: { stroke: strokeOf('#000000ff', 1) } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { width: 2 } });
    const h = getInvoker().start(ctx, { params: { width: 2 } });
    h.onMove?.({ ...ctx, params: { width: 5 } });
    expect((h.previewData?.('a' as unknown as NodeId) as { stroke: Stroke }).stroke.width).toBe(5);
    h.onEnd?.(ctx, 'commit');
    expect(strokeAfter(scene).width).toBe(5);
  });

  it('gives a node with no stroke a default-colored one at that width', () => {
    const scene = makeScene({ a: {} });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { width: 4 } });
    getInvoker().start(ctx, { params: { width: 4 } }).onEnd?.(ctx, 'commit');
    expect(strokeAfter(scene)).toEqual({ paint: { color: '#000000' }, width: 4 });
  });
});
