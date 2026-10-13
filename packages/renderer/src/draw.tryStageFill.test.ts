import { describe, it, expect } from 'vitest';
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { DrawCommand } from './DrawCommand';
import { dispatch, tryStageFill, meshBatching, type DrawContext } from './draw';
import { createRecorderCtx } from './testing/recorderCtx';

/**
 * The chokepoint that makes a forgotten flush unexpressible: an emitter only
 * gets to draw for itself when this said `false`, and `false` is only returned
 * after the staged run has been drawn.
 */
describe('tryStageFill', () => {
  const stagedRect: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    fill: { paint: { color: '#ff0000' } },
  } as DrawCommand;

  const triangle = (vertexCount = 3, extra: Partial<Mesh> = {}): Mesh => ({
    vertices: new Float32Array(vertexCount * 2),
    indices: new Uint32Array([0, 1, 2]),
    ...extra,
  });

  /** A run is staged and undrawn; anything the recorder draws came from a flush. */
  function withStagedRun(): { ctx: DrawContext; drawCount: () => number } {
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, stagedRect);
    expect(calls.filter((c) => c.name === 'drawElements')).toHaveLength(0);
    return { ctx, drawCount: () => calls.filter((c) => c.name === 'drawElements').length };
  }

  it('stages a batchable mesh, leaving the run undrawn', () => {
    const { ctx, drawCount } = withStagedRun();
    expect(tryStageFill(ctx, triangle(), { kind: 'solid', color: '#0000ff' })).toBe(true);
    expect(drawCount()).toBe(0);
  });

  it('flushes before answering false for a paint a run cannot carry', () => {
    const { ctx, drawCount } = withStagedRun();
    expect(tryStageFill(ctx, triangle(), undefined)).toBe(false);
    expect(drawCount()).toBe(1);
  });

  it('flushes before answering false for a mesh past the vertex cap', () => {
    const { ctx, drawCount } = withStagedRun();
    expect(tryStageFill(ctx, triangle(meshBatching.maxVerticesInRun + 1), { kind: 'solid', color: '#0000ff' })).toBe(false);
    expect(drawCount()).toBe(1);
  });

  it('flushes before answering false for a mesh needing its own stencil pass', () => {
    const { ctx, drawCount } = withStagedRun();
    expect(tryStageFill(ctx, triangle(3, { requiresStencil: true }), { kind: 'solid', color: '#0000ff' })).toBe(false);
    expect(drawCount()).toBe(1);
  });
});
