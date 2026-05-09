import { describe, expect, it, vi } from 'vitest';
import { type RenderLayer, drawLayers } from './render';

function makeCtxStub(): CanvasRenderingContext2D & {
  setTransform: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
} {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D & {
    setTransform: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
}

function makeLayer(id: string, opts: Partial<RenderLayer<number>> = {}): RenderLayer<number> {
  return {
    id,
    label: id,
    draw: vi.fn(),
    ...opts,
  };
}

describe('drawLayers', () => {
  it('draws all layers when visibility map is empty (default visible)', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a');
    const b = makeLayer('b');
    drawLayers(ctx, [a, b], 1, {});
    expect(a.draw).toHaveBeenCalledTimes(1);
    expect(b.draw).toHaveBeenCalledTimes(1);
  });

  it('passes ctx, data, and view to each draw fn', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a');
    drawLayers(ctx, [a], 42, {});
    expect(a.draw).toHaveBeenCalledWith(ctx, 42, { x: 0, y: 0, scale: 1 });
  });

  it('respects defaultVisible: false', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a', { defaultVisible: false });
    drawLayers(ctx, [a], 0, {});
    expect(a.draw).not.toHaveBeenCalled();
  });

  it('explicit visibility overrides defaultVisible', () => {
    const ctx = makeCtxStub();
    const hidden = makeLayer('hidden', { defaultVisible: true });
    const shown = makeLayer('shown', { defaultVisible: false });
    drawLayers(ctx, [hidden, shown], 0, { hidden: false, shown: true });
    expect(hidden.draw).not.toHaveBeenCalled();
    expect(shown.draw).toHaveBeenCalled();
  });

  it('alwaysOn ignores visibility map', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a', { alwaysOn: true });
    drawLayers(ctx, [a], 0, { a: false });
    expect(a.draw).toHaveBeenCalled();
  });

  it('order array controls draw sequence', () => {
    const ctx = makeCtxStub();
    const calls: string[] = [];
    const a = makeLayer('a', { draw: () => { calls.push('a'); } });
    const b = makeLayer('b', { draw: () => { calls.push('b'); } });
    const c = makeLayer('c', { draw: () => { calls.push('c'); } });
    drawLayers(ctx, [a, b, c], 0, {}, ['c', 'a', 'b']);
    expect(calls).toEqual(['c', 'a', 'b']);
  });

  it('layers absent from order array are skipped', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a');
    const b = makeLayer('b');
    drawLayers(ctx, [a, b], 0, {}, ['a']);
    expect(a.draw).toHaveBeenCalled();
    expect(b.draw).not.toHaveBeenCalled();
  });

  it('unknown ids in order are silently dropped', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a');
    drawLayers(ctx, [a], 0, {}, ['ghost', 'a']);
    expect(a.draw).toHaveBeenCalledTimes(1);
  });

  it('does not call drawGL — that is the GL backend dispatcher concern', () => {
    const ctx = makeCtxStub();
    const drawGL = vi.fn(() => []);
    const draw = vi.fn();
    const layer: RenderLayer<number> = { id: 'x', label: 'X', draw, drawGL };
    drawLayers(ctx, [layer], 0, {});
    expect(draw).toHaveBeenCalledOnce();
    expect(drawGL).not.toHaveBeenCalled();
  });
});

describe('drawLayers — view-aware transforms', () => {
  it('omitted view leaves transform untouched for world layers (no scale, no translate)', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'a', draw }];
    drawLayers(ctx, layers, null, {});
    // Identity view: scale === 1 and pan === 0 → no transform calls.
    expect(ctx.setTransform).not.toHaveBeenCalled();
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledWith(ctx, null, { x: 0, y: 0, scale: 1 });
  });

  it('world layer at scale=1 composes a translate(-view.x, -view.y) onto the existing transform', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'a', draw }];
    drawLayers(ctx, layers, null, {}, undefined, { x: 10, y: 20, scale: 1 });
    expect(ctx.translate).toHaveBeenCalledWith(-10, -20);
    expect(ctx.setTransform).not.toHaveBeenCalled();
  });

  it('world layer at scale != 1 composes scale then translate', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layer: RenderLayer<null> = { id: 'a', label: 'a', draw };
    drawLayers(ctx, [layer], null, {}, undefined, { x: 5, y: 10, scale: 2 });
    // Note: translate uses world-coord offsets, not pre-multiplied screen px.
    // ctx.scale composes the pixel multiplication.
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);
    expect(ctx.translate).toHaveBeenCalledWith(-5, -10);
    expect(ctx.setTransform).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledWith(ctx, null, { x: 5, y: 10, scale: 2 });
  });

  it('screen-space layers do not modify the transform (DPR preserved)', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layer: RenderLayer<null> = { id: 'a', label: 'a', space: 'screen', draw };
    drawLayers(ctx, [layer], null, {}, undefined, { x: 5, y: 10, scale: 2 });
    expect(ctx.scale).not.toHaveBeenCalled();
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(ctx.setTransform).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledWith(ctx, null, { x: 5, y: 10, scale: 2 });
  });

  it('save/restore wraps each draw', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layer: RenderLayer<null> = { id: 'a', label: 'a', draw };
    drawLayers(ctx, [layer], null, {}, undefined, { x: 0, y: 0, scale: 1 });
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
