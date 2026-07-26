import { describe, expect, it, vi } from 'vitest';
import type { DrawCommand, PathDrawCommand } from '../../renderer';
import { createChildrenLayer } from './children';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 100, height: 100 };

describe('createChildrenLayer', () => {
  it('iterates getChildren in order, calls drawChild once per id', () => {
    const draws: string[] = [];
    const layer = createChildrenLayer({
      adapter: { getChildren: () => ['a', 'b', 'c'] },
      drawChild: (id) => { draws.push(id); return []; },
    });
    layer.draw(undefined, VIEW, DIMS);
    expect(draws).toEqual(['a', 'b', 'c']);
  });

  it('default parentId is null (root)', () => {
    const seen: (string | null)[] = [];
    const layer = createChildrenLayer({
      adapter: {
        getChildren: (p) => { seen.push(p); return []; },
      },
      drawChild: () => [],
    });
    layer.draw(undefined, VIEW, DIMS);
    expect(seen).toEqual([null]);
  });

  it('static parentId string flows through', () => {
    const seen: (string | null)[] = [];
    const layer = createChildrenLayer({
      adapter: {
        getChildren: (p) => { seen.push(p); return []; },
      },
      parentId: 'group-1',
      drawChild: () => [],
    });
    layer.draw(undefined, VIEW, DIMS);
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
      drawChild: () => [],
    });
    layer.draw(undefined, VIEW, DIMS);
    current = 'b';
    layer.draw(undefined, VIEW, DIMS);
    current = null;
    layer.draw(undefined, VIEW, DIMS);
    expect(seen).toEqual(['a', 'b', null]);
  });

  it('adapter without getChildren: silent no-op', () => {
    const drawChild = vi.fn(() => [] as DrawCommand[]);
    const layer = createChildrenLayer({
      adapter: {},
      drawChild,
    });
    layer.draw(undefined, VIEW, DIMS);
    expect(drawChild).not.toHaveBeenCalled();
  });

  it('empty children list: no draws', () => {
    const drawChild = vi.fn(() => [] as DrawCommand[]);
    const layer = createChildrenLayer({
      adapter: { getChildren: () => [] },
      drawChild,
    });
    layer.draw(undefined, VIEW, DIMS);
    expect(drawChild).not.toHaveBeenCalled();
  });

  it('default id and label', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => [] },
      drawChild: () => [],
    });
    expect(layer.id).toBe('children');
    expect(layer.label).toBe('Children');
  });

  it('custom id and label flow through', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => [] },
      drawChild: () => [],
      id: 'shapes',
      label: 'Shapes',
    });
    expect(layer.id).toBe('shapes');
    expect(layer.label).toBe('Shapes');
  });

  it('defaultVisible / alwaysOn forwarded', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => [] },
      drawChild: () => [],
      defaultVisible: false,
      alwaysOn: true,
    });
    expect(layer.defaultVisible).toBe(false);
    expect(layer.alwaysOn).toBe(true);
  });

  it('draw aggregates drawChild outputs across children in z-order', () => {
    const layer = createChildrenLayer({
      adapter: { getChildren: () => ['a', 'b'] },
      drawChild: (id): DrawCommand[] => [
        {
          kind: 'path',
          path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
          fill: { fill: 'solid', color: id === 'a' ? '#f00' : '#0f0' },
        },
      ],
    });
    const tree = layer.draw(undefined, VIEW, DIMS);
    expect(tree).toHaveLength(2);
    expect((tree[0] as PathDrawCommand).fill).toMatchObject({ color: '#f00' });
    expect((tree[1] as PathDrawCommand).fill).toMatchObject({ color: '#0f0' });
  });

  it('drawChild receives id, data, and view passthroughs', () => {
    const calls: { id: string; data: unknown; view: unknown }[] = [];
    const data = { tag: 'render-data' };
    const layer = createChildrenLayer<typeof data>({
      adapter: { getChildren: () => ['x'] },
      drawChild: (id, d, view) => { calls.push({ id, data: d, view }); return []; },
    });
    layer.draw(data, VIEW, DIMS);
    expect(calls).toEqual([{ id: 'x', data, view: VIEW }]);
  });
});
