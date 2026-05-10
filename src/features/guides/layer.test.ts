import { describe, expect, it } from 'vitest';
import type { PathDrawCommand } from '../../renderer';
import { createGuidesLayer } from './layer';
import type { Guide } from './types';

describe('createGuidesLayer', () => {
  it('exposes default id "guides", label "Guides", and screen space', () => {
    const layer = createGuidesLayer({ getGuides: () => [] });
    expect(layer.id).toBe('guides');
    expect(layer.label).toBe('Guides');
    expect(layer.space).toBe('screen');
  });

  it('returns [] when there are no guides', () => {
    const layer = createGuidesLayer({ getGuides: () => [] });
    expect(layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 200, height: 100 })).toEqual([]);
  });

  it('draws a vertical line for an x-axis guide and a horizontal line for a y-axis guide', () => {
    const guides: Guide[] = [
      { id: 'vx', axis: 'x', offset: 50 },
      { id: 'hy', axis: 'y', offset: 25 },
    ];
    const layer = createGuidesLayer({ getGuides: () => guides });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 200, height: 100 });
    expect(tree).toHaveLength(2);

    const v = tree[0] as PathDrawCommand;
    expect(v.kind).toBe('path');
    expect(v.path.kind).toBe('polygon');
    if (v.path.kind === 'polygon') {
      // Vertical: same X, full canvas height.
      expect(Array.from(v.path.coords)).toEqual([50, 0, 50, 100]);
    }

    const h = tree[1] as PathDrawCommand;
    if (h.path.kind === 'polygon') {
      // Horizontal: full canvas width, same Y.
      expect(Array.from(h.path.coords)).toEqual([0, 25, 200, 25]);
    }
  });

  it('projects world offset through the view (pan + scale)', () => {
    const guides: Guide[] = [{ id: 'vx', axis: 'x', offset: 100 }];
    const layer = createGuidesLayer({ getGuides: () => guides });
    // view.x = 50, scale = 2 → screen x = (100 - 50) * 2 = 100.
    const tree = layer.draw(undefined, { x: 50, y: 0, scale: 2 }, { width: 200, height: 100 });
    const v = tree[0] as PathDrawCommand;
    if (v.path.kind === 'polygon') {
      expect(Array.from(v.path.coords)).toEqual([100, 0, 100, 100]);
    }
  });

  it('skips guides outside the visible canvas', () => {
    const guides: Guide[] = [
      { id: 'in', axis: 'x', offset: 50 },
      { id: 'out', axis: 'x', offset: 1000 },
    ];
    const layer = createGuidesLayer({ getGuides: () => guides });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 200, height: 100 });
    expect(tree).toHaveLength(1);
  });

  it('honors lineWidth and color overrides', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 50 }];
    const layer = createGuidesLayer({
      getGuides: () => guides,
      lineWidth: 2,
      color: '#ff00aa',
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 200, height: 100 });
    const v = tree[0] as PathDrawCommand;
    expect(v.stroke?.width).toBe(2);
    expect((v.stroke?.paint as { color: string } | undefined)?.color).toBe('#ff00aa');
  });

  it('id and label can be overridden', () => {
    const layer = createGuidesLayer({
      getGuides: () => [],
      id: 'user-guides',
      label: 'User guides',
    });
    expect(layer.id).toBe('user-guides');
    expect(layer.label).toBe('User guides');
  });
});
