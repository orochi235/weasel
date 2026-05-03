import { describe, expect, it, vi } from 'vitest';
import { createChildrenLayer } from './children';

const fakeCtx = {} as CanvasRenderingContext2D;

describe('createChildrenLayer', () => {
  it('iterates getChildren in order, calls drawChild once per id', () => {
    const draws: string[] = [];
    const layer = createChildrenLayer({
      adapter: { getChildren: () => ['a', 'b', 'c'] },
      drawChild: (_ctx, id) => { draws.push(id); },
    });
    layer.draw(fakeCtx, undefined);
    expect(draws).toEqual(['a', 'b', 'c']);
  });

  it('default parentId is null (root)', () => {
    const seen: (string | null)[] = [];
    const layer = createChildrenLayer({
      adapter: {
        getChildren: (p) => { seen.push(p); return []; },
      },
      drawChild: () => {},
    });
    layer.draw(fakeCtx, undefined);
    expect(seen).toEqual([null]);
  });

  it('static parentId string flows through', () => {
    const seen: (string | null)[] = [];
    const layer = createChildrenLayer({
      adapter: {
        getChildren: (p) => { seen.push(p); return []; },
      },
      parentId: 'group-1',
      drawChild: () => {},
    });
    layer.draw(fakeCtx, undefined);
    expect(seen).toEqual(['group-1']);
  });

  it('parentId function is evaluated each draw', () => {
    let current: string | null = 'a';
    const seen: (string | null)[] = [];
    const layer = createChildrenLayer({
      adapter: {
        getChildren: (p) => { seen.push(p); return []; },
      },
      parentId: () => current,
      drawChild: () => {},
    });
    layer.draw(fakeCtx, undefined);
    current = 'b';
    layer.draw(fakeCtx, undefined);
    current = null;
    layer.draw(fakeCtx, undefined);
    expect(seen).toEqual(['a', 'b', null]);
  });

  it('adapter without getChildren: silent no-op', () => {
    const drawChild = vi.fn();
    const layer = createChildrenLayer({
      adapter: {},
      drawChild,
    });
    layer.draw(fakeCtx, undefined);
    expect(drawChild).not.toHaveBeenCalled();
  });

  it('empty children list: no draws', () => {
    const drawChild = vi.fn();
    const layer = createChildrenLayer({
      adapter: { getChildren: () => [] },
      drawChild,
    });
    layer.draw(fakeCtx, undefined);
    expect(drawChild).not.toHaveBeenCalled();
  });

  it('default id and label', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => [] },
      drawChild: () => {},
    });
    expect(layer.id).toBe('children');
    expect(layer.label).toBe('Children');
  });

  it('custom id and label flow through', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => [] },
      drawChild: () => {},
      id: 'shapes',
      label: 'Shapes',
    });
    expect(layer.id).toBe('shapes');
    expect(layer.label).toBe('Shapes');
  });

  it('defaultVisible / alwaysOn forwarded', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => [] },
      drawChild: () => {},
      defaultVisible: false,
      alwaysOn: true,
    });
    expect(layer.defaultVisible).toBe(false);
    expect(layer.alwaysOn).toBe(true);
  });

  it('drawChild receives ctx and data passthroughs', () => {
    const calls: { ctx: CanvasRenderingContext2D; id: string; data: unknown }[] = [];
    const data = { tag: 'render-data' };
    const layer = createChildrenLayer<typeof data>({
      adapter: { getChildren: () => ['x'] },
      drawChild: (ctx, id, d) => { calls.push({ ctx, id, data: d }); },
    });
    layer.draw(fakeCtx, data);
    expect(calls).toEqual([{ ctx: fakeCtx, id: 'x', data }]);
  });
});
