import { describe, expect, it } from 'vitest';
import type { DrawCommand, PathDrawCommand, TextDrawCommand } from '@weasel-js/core';
import { createGuidesLayer } from './layer';
import type { Guide, SpacingGap } from './types';

describe('createGuidesLayer', () => {
  it('exposes default id "guides", label "Guides", and screen space', () => {
    const layer = createGuidesLayer({ getGuides: () => [] });
    expect(layer.id).toBe('guides');
    expect(layer.label).toBe('Guides');
    expect(layer.space).toBe('screen');
  });

  it('returns [] when there are no guides', () => {
    const layer = createGuidesLayer({ getGuides: () => [] });
    expect(layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 200, height: 100 })).toEqual([]);
  });

  it('draws a vertical line for an x-axis guide and a horizontal line for a y-axis guide', () => {
    const guides: Guide[] = [
      { id: 'vx', axis: 'x', offset: 50 },
      { id: 'hy', axis: 'y', offset: 25 },
    ];
    const layer = createGuidesLayer({ getGuides: () => guides });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 200, height: 100 });
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
    const tree = layer.draw(undefined, { x: 50, y: 0, scale: { x: 2, y: 2 } }, { width: 200, height: 100 });
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
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 200, height: 100 });
    expect(tree).toHaveLength(1);
  });

  it('honors lineWidth and color overrides', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 50 }];
    const layer = createGuidesLayer({
      getGuides: () => guides,
      lineWidth: 2,
      color: '#ff00aa',
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 200, height: 100 });
    const v = tree[0] as PathDrawCommand;
    expect(v.stroke?.width).toBe(2);
    expect((v.stroke?.paint as { color: string } | undefined)?.color).toBe('#ff00aa');
  });

  const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const dims = { width: 200, height: 100 };
  const coords = (c: DrawCommand) => {
    const p = (c as PathDrawCommand).path;
    return p.kind === 'polygon' ? Array.from(p.coords) : [];
  };

  it('draws a guide with a span as a segment with end ticks', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 50, span: { min: 10, max: 60 } }];
    const [v] = createGuidesLayer({ getGuides: () => guides, ticks: 6 }).draw(undefined, view, dims);
    expect(coords(v)).toEqual([50, 10, 50, 60, 47, 10, 53, 10, 47, 60, 53, 60]);
  });

  it('projects a span through the view', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'y', offset: 20, span: { min: 10, max: 60 } }];
    const tree = createGuidesLayer({ getGuides: () => guides, ticks: 0 })
      .draw(undefined, { x: 5, y: 0, scale: { x: 2, y: 2 } }, dims);
    expect(coords(tree[0])).toEqual([10, 40, 110, 40]);
  });

  it("extent: 'full' draws a spanned guide across the canvas", () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 50, span: { min: 10, max: 60 } }];
    const [v] = createGuidesLayer({ getGuides: () => guides, extent: 'full' }).draw(undefined, view, dims);
    expect(coords(v)).toEqual([50, 0, 50, 100]);
  });

  it('draws each gap as a ticked segment with its size labeled', () => {
    const gaps: SpacingGap[] = [{ axis: 'x', min: 20, max: 40, at: 30 }];
    const tree = createGuidesLayer({ getGuides: () => [], getGaps: () => gaps, ticks: 6 }).draw(undefined, view, dims);
    expect(coords(tree[0])).toEqual([20, 30, 40, 30, 20, 27, 20, 33, 40, 27, 40, 33]);
    const text = tree.find((c): c is TextDrawCommand => c.kind === 'text');
    expect(text?.runs.map((r) => r.text).join('')).toBe('20');
  });

  it('gapLabels formats or drops the label', () => {
    const gaps: SpacingGap[] = [{ axis: 'y', min: 0, max: 12.5, at: 30 }];
    const text = (opt: boolean | ((n: number) => string)) =>
      createGuidesLayer({ getGuides: () => [], getGaps: () => gaps, gapLabels: opt })
        .draw(undefined, view, dims)
        .filter((c): c is TextDrawCommand => c.kind === 'text')
        .map((c) => c.runs.map((r) => r.text).join(''));
    expect(text(false)).toEqual([]);
    expect(text((n) => `${n.toFixed(1)}px`)).toEqual(['12.5px']);
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
