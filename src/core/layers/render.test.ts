import { describe, expect, it, vi } from 'vitest';
import { type RenderLayer, runLayers } from './render';

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

describe('runLayers', () => {
  it('draws all layers when visibility map is empty (default visible)', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a');
    const b = makeLayer('b');
    runLayers(ctx, [a, b], 1, {});
    expect(a.draw).toHaveBeenCalledTimes(1);
    expect(b.draw).toHaveBeenCalledTimes(1);
  });

  it('passes ctx, data, and view to each draw fn', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a');
    runLayers(ctx, [a], 42, {});
    expect(a.draw).toHaveBeenCalledWith(ctx, 42, { x: 0, y: 0, scale: 1 });
  });

  it('respects defaultVisible: false', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a', { defaultVisible: false });
    runLayers(ctx, [a], 0, {});
    expect(a.draw).not.toHaveBeenCalled();
  });

  it('explicit visibility overrides defaultVisible', () => {
    const ctx = makeCtxStub();
    const hidden = makeLayer('hidden', { defaultVisible: true });
    const shown = makeLayer('shown', { defaultVisible: false });
    runLayers(ctx, [hidden, shown], 0, { hidden: false, shown: true });
    expect(hidden.draw).not.toHaveBeenCalled();
    expect(shown.draw).toHaveBeenCalled();
  });

  it('alwaysOn ignores visibility map', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a', { alwaysOn: true });
    runLayers(ctx, [a], 0, { a: false });
    expect(a.draw).toHaveBeenCalled();
  });

  it('order array controls draw sequence', () => {
    const ctx = makeCtxStub();
    const calls: string[] = [];
    const a = makeLayer('a', { draw: () => { calls.push('a'); } });
    const b = makeLayer('b', { draw: () => { calls.push('b'); } });
    const c = makeLayer('c', { draw: () => { calls.push('c'); } });
    runLayers(ctx, [a, b, c], 0, {}, ['c', 'a', 'b']);
    expect(calls).toEqual(['c', 'a', 'b']);
  });

  it('layers absent from order array are skipped', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a');
    const b = makeLayer('b');
    runLayers(ctx, [a, b], 0, {}, ['a']);
    expect(a.draw).toHaveBeenCalled();
    expect(b.draw).not.toHaveBeenCalled();
  });

  it('unknown ids in order are silently dropped', () => {
    const ctx = makeCtxStub();
    const a = makeLayer('a');
    runLayers(ctx, [a], 0, {}, ['ghost', 'a']);
    expect(a.draw).toHaveBeenCalledTimes(1);
  });
});

describe('runLayers — view-aware transforms', () => {
  it('omitted view uses identity setTransform for world layers', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'a', draw }];
    runLayers(ctx, layers, null, {});
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(draw).toHaveBeenCalledWith(ctx, null, { x: 0, y: 0, scale: 1 });
  });

  it('world layer (default) at scale=1 translates by -view.x*scale, -view.y*scale', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'a', draw }];
    runLayers(ctx, layers, null, {}, undefined, { x: 10, y: 20, scale: 1 });
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, -10, -20);
  });

  it('uses setTransform with scale for world-space layers', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layer: RenderLayer<null> = { id: 'a', label: 'a', draw };
    runLayers(ctx, [layer], null, {}, undefined, { x: 5, y: 10, scale: 2 });
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, -10, -20);
    expect(draw).toHaveBeenCalledWith(ctx, null, { x: 5, y: 10, scale: 2 });
  });

  it('uses identity setTransform for screen-space layers', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layer: RenderLayer<null> = { id: 'a', label: 'a', space: 'screen', draw };
    runLayers(ctx, [layer], null, {}, undefined, { x: 5, y: 10, scale: 2 });
    expect(ctx.setTransform).toHaveBeenLastCalledWith(1, 0, 0, 1, 0, 0);
    expect(draw).toHaveBeenCalledWith(ctx, null, { x: 5, y: 10, scale: 2 });
  });

  it('save/restore wraps each draw', () => {
    const ctx = makeCtxStub();
    const draw = vi.fn();
    const layer: RenderLayer<null> = { id: 'a', label: 'a', draw };
    runLayers(ctx, [layer], null, {}, undefined, { x: 0, y: 0, scale: 1 });
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
