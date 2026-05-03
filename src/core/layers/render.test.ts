import { describe, expect, it, vi } from 'vitest';
import { type RenderLayer, runLayers } from './render';

function makeLayer(id: string, opts: Partial<RenderLayer<number>> = {}): RenderLayer<number> {
  return {
    id,
    label: id,
    draw: vi.fn(),
    ...opts,
  };
}

describe('runLayers', () => {
  const ctx = {} as CanvasRenderingContext2D;

  it('draws all layers when visibility map is empty (default visible)', () => {
    const a = makeLayer('a');
    const b = makeLayer('b');
    runLayers(ctx, [a, b], 1, {});
    expect(a.draw).toHaveBeenCalledTimes(1);
    expect(b.draw).toHaveBeenCalledTimes(1);
  });

  it('passes ctx and data to each draw fn', () => {
    const a = makeLayer('a');
    runLayers(ctx, [a], 42, {});
    expect(a.draw).toHaveBeenCalledWith(ctx, 42);
  });

  it('respects defaultVisible: false', () => {
    const a = makeLayer('a', { defaultVisible: false });
    runLayers(ctx, [a], 0, {});
    expect(a.draw).not.toHaveBeenCalled();
  });

  it('explicit visibility overrides defaultVisible', () => {
    const hidden = makeLayer('hidden', { defaultVisible: true });
    const shown = makeLayer('shown', { defaultVisible: false });
    runLayers(ctx, [hidden, shown], 0, { hidden: false, shown: true });
    expect(hidden.draw).not.toHaveBeenCalled();
    expect(shown.draw).toHaveBeenCalled();
  });

  it('alwaysOn ignores visibility map', () => {
    const a = makeLayer('a', { alwaysOn: true });
    runLayers(ctx, [a], 0, { a: false });
    expect(a.draw).toHaveBeenCalled();
  });

  it('order array controls draw sequence', () => {
    const calls: string[] = [];
    const a = makeLayer('a', { draw: () => { calls.push('a'); } });
    const b = makeLayer('b', { draw: () => { calls.push('b'); } });
    const c = makeLayer('c', { draw: () => { calls.push('c'); } });
    runLayers(ctx, [a, b, c], 0, {}, ['c', 'a', 'b']);
    expect(calls).toEqual(['c', 'a', 'b']);
  });

  it('layers absent from order array are skipped', () => {
    const a = makeLayer('a');
    const b = makeLayer('b');
    runLayers(ctx, [a, b], 0, {}, ['a']);
    expect(a.draw).toHaveBeenCalled();
    expect(b.draw).not.toHaveBeenCalled();
  });

  it('unknown ids in order are silently dropped', () => {
    const a = makeLayer('a');
    runLayers(ctx, [a], 0, {}, ['ghost', 'a']);
    expect(a.draw).toHaveBeenCalledTimes(1);
  });
});

describe('runLayers — view-aware translation', () => {
  function makeCtx() {
    const calls: string[] = [];
    const ctx = {
      save: vi.fn(() => calls.push('save')),
      restore: vi.fn(() => calls.push('restore')),
      translate: vi.fn((x: number, y: number) => calls.push(`translate(${x},${y})`)),
    } as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  }

  it('legacy: when view is omitted, no save/translate/restore wrapping', () => {
    const { ctx, calls } = makeCtx();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'a', draw }];
    runLayers(ctx, layers, null, {});
    expect(draw).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it('world layer (default): translates by -view.x, -view.y around draw', () => {
    const { ctx, calls } = makeCtx();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'a', draw }];
    runLayers(ctx, layers, null, {}, undefined, { x: 10, y: 20 });
    expect(calls).toEqual(['save', 'translate(-10,-20)', 'restore']);
  });

  it('screen layer: save/restore only (no translate)', () => {
    const { ctx, calls } = makeCtx();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [
      { id: 'a', label: 'a', draw, space: 'screen' },
    ];
    runLayers(ctx, layers, null, {}, undefined, { x: 10, y: 20 });
    expect(calls).toEqual(['save', 'restore']);
  });

  it('explicit space: world is equivalent to default', () => {
    const { ctx, calls } = makeCtx();
    const draw = vi.fn();
    const layers: RenderLayer<unknown>[] = [
      { id: 'a', label: 'a', draw, space: 'world' },
    ];
    runLayers(ctx, layers, null, {}, undefined, { x: 5, y: 0 });
    // JS template literals render -0 as "0", so the string is 'translate(-5,0)'.
    expect(calls).toEqual(['save', 'translate(-5,0)', 'restore']);
  });
});
