import { describe, expect, it } from 'vitest';
import { type PathDrawCommand, IMPERIAL_INCHES } from '@weasel-js/core';
import { createGridLayer } from './layer';

describe('createGridLayer', () => {
  it('exposes id "grid" and label "Grid"', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    expect(layer.id).toBe('grid');
    expect(layer.label).toBe('Grid');
  });

  it('draw emits one path per cell line', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 30, height: 30 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100, dpr: 1 });
    // 30/10 → 4 vertical lines + 4 horizontal lines = 8 paths. drawLayers
    // wraps these in a viewToMat3 group at the orchestration layer.
    expect(tree.filter((c) => c.kind === 'path')).toHaveLength(8);
  });

  it('draw returns [] for zero-sized bounds', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100, dpr: 1 });
    expect(tree).toEqual([]);
  });

  it('keeps every line 1px on screen under non-uniform zoom', () => {
    // A vertical line's width runs along x and a horizontal one's along y, so
    // each divides by its own axis's scale.
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 4, y: 1 } }, { width: 100, height: 100, dpr: 1 });
    const paths = tree as PathDrawCommand[];
    for (const p of paths) {
      const c = (p.path as { coords: ArrayLike<number> }).coords;
      const vertical = c[0] === c[2];
      expect(p.stroke?.width).toBeCloseTo(vertical ? 1 / 4 : 1, 6);
    }
    expect(paths.length).toBe(4);
  });

  it('draw divides stroke width by view.scale so hairlines stay 1px on screen', () => {
    const layer = createGridLayer({
      spacing: 10,
      bounds: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 2, y: 2 } }, { width: 100, height: 100, dpr: 1 });
    const first = tree[0] as PathDrawCommand;
    expect(first.stroke?.width).toBe(0.5);
  });

  it('draw with accentEvery emits accent + line bands (sub omitted)', () => {
    const layer = createGridLayer({
      spacing: 10,
      accentEvery: 5,
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100, dpr: 1 });
    // Total cell+accent lines: 11 vlines (0..100 step 10 inclusive) + 11 hlines = 22
    expect(tree.filter((c) => c.kind === 'path')).toHaveLength(22);
  });

  it('resolves a tagged cell value via the unit system (1ft -> 12in spacing)', () => {
    const layer = createGridLayer({
      spacing: { value: 1, unit: 'ft' },
      unitSystem: IMPERIAL_INCHES,
      bounds: () => ({ x: 0, y: 0, width: 24, height: 12 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100, dpr: 1 });
    // 24in wide x 12in tall, cell = 12in → 3 vertical lines (x=0,12,24) + 2 horizontal lines (y=0,12) = 5 paths.
    expect(tree.filter((c) => c.kind === 'path')).toHaveLength(5);
  });

  it('throws at draw time when a tagged cell is given without a unit system', () => {
    const layer = createGridLayer({
      spacing: { value: 1, unit: 'ft' },
      bounds: () => ({ x: 0, y: 0, width: 24, height: 12 }),
    });
    expect(() => layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100, dpr: 1 })).toThrow(/UnitSystem/);
  });

  it('spaces each axis by its own pitch', () => {
    const layer = createGridLayer({
      spacing: { x: 10, y: 15 },
      bounds: () => ({ x: 0, y: 0, width: 30, height: 30 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100, dpr: 1 });
    // 4 vertical lines at x = 0, 10, 20, 30 and 3 horizontal at y = 0, 15, 30.
    expect(tree.filter((c) => c.kind === 'path')).toHaveLength(7);
  });

  it('hands the paint-time view and dims to bounds', () => {
    const seen: unknown[] = [];
    const layer = createGridLayer({
      spacing: 10,
      bounds: (view, dims) => { seen.push(view, dims); return { x: 0, y: 0, width: 10, height: 10 }; },
    });
    const view = { x: 5, y: 7, scale: { x: 2, y: 2 } };
    layer.draw(undefined, view, { width: 300, height: 200, dpr: 1 });
    expect(seen).toEqual([view, { width: 300, height: 200, dpr: 1 }]);
  });

  describe('with bounds omitted', () => {
    const coords = (tree: unknown[]) => (tree as PathDrawCommand[])
      .map((p) => Array.from((p.path as { coords: ArrayLike<number> }).coords));
    const verticalXs = (tree: unknown[]) => [...new Set(coords(tree).filter((c) => c[0] === c[2]).map((c) => c[0]))].sort((a, b) => a - b);

    it('covers the visible world rect, which follows the canvas size', () => {
      const layer = createGridLayer({ spacing: 10 });
      const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
      expect(verticalXs(layer.draw(undefined, view, { width: 30, height: 30, dpr: 1 }))).toEqual([0, 10, 20, 30]);
      expect(verticalXs(layer.draw(undefined, view, { width: 50, height: 30, dpr: 1 }))).toEqual([0, 10, 20, 30, 40, 50]);
    });

    it('divides the canvas size by the zoom', () => {
      const layer = createGridLayer({ spacing: 10 });
      const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 2, y: 2 } }, { width: 60, height: 20, dpr: 1 });
      expect(verticalXs(tree)).toEqual([0, 10, 20, 30]);
    });

    it('keeps lines on the world lattice when the view is panned off it', () => {
      const layer = createGridLayer({ spacing: 10 });
      const tree = layer.draw(undefined, { x: 3, y: -4, scale: { x: 1, y: 1 } }, { width: 20, height: 20, dpr: 1 });
      expect(verticalXs(tree)).toEqual([10, 20]);
      for (const c of coords(tree)) {
        if (c[0] === c[2]) expect([c[1], c[3]]).toEqual([-5, 17]);
      }
    });

    it('keeps accent lines on world multiples of the accent pitch while panning', () => {
      const layer = createGridLayer({
        spacing: 10,
        accentEvery: 5,
        style: { accent: { paint: { kind: 'solid', color: 'red' }, width: 1 } },
      });
      const tree = layer.draw(undefined, { x: 23, y: 0, scale: { x: 1, y: 1 } }, { width: 40, height: 10, dpr: 1 }) as PathDrawCommand[];
      const accentXs = tree
        .filter((p) => (p.stroke?.paint as { color?: string }).color === 'red')
        .map((p) => (p.path as { coords: ArrayLike<number> }).coords)
        .filter((c) => c[0] === c[2])
        .map((c) => c[0]);
      expect(accentXs.every((x) => x % 50 === 0)).toBe(true);
      expect(accentXs).toContain(50);
    });

    it('draws nothing at a zero zoom rather than looping without end', () => {
      const layer = createGridLayer({ spacing: 10 });
      expect(layer.draw(undefined, { x: 0, y: 0, scale: { x: 0, y: 1 } }, { width: 100, height: 100, dpr: 1 })).toEqual([]);
    });
  });

  describe('zoomed out', () => {
    const RED = { paint: { kind: 'solid', color: 'red' }, width: 1 } as const;
    const colorOf = (c: unknown) => ((c as PathDrawCommand).stroke?.paint as { color?: string }).color;

    it('leaves out cell lines closer than a few pixels and lets accents carry on alone', () => {
      const layer = createGridLayer({ spacing: 10, accentEvery: 5, style: { accent: RED } });
      // Cells 1px apart on screen, accents 5px apart.
      const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 0.1, y: 0.1 } }, { width: 800, height: 600, dpr: 1 });
      expect(tree.length).toBeGreaterThan(0);
      expect(tree.every((c) => colorOf(c) === 'red')).toBe(true);
      expect(tree.length).toBeLessThanOrEqual(800 / 5 + 3 + 600 / 5 + 3);
    });

    it('draws nothing once accents are that close too', () => {
      const layer = createGridLayer({ spacing: 10, accentEvery: 5 });
      const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 0.001, y: 0.001 } }, { width: 800, height: 600, dpr: 1 });
      expect(tree).toEqual([]);
    });

    it('drops subdivisions before cell lines', () => {
      const layer = createGridLayer({
        spacing: 10,
        subdivisions: 4,
        bounds: () => ({ x: 0, y: 0, width: 30, height: 30 }),
      });
      // Sub-lines 2.5px apart, cells 10px.
      const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100, dpr: 1 });
      expect(tree).toHaveLength(8);
    });

    it('decides each axis by its own zoom', () => {
      const layer = createGridLayer({ spacing: 10, bounds: () => ({ x: 0, y: 0, width: 30, height: 30 }) });
      const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 0.1, y: 1 } }, { width: 100, height: 100, dpr: 1 });
      // Vertical lines would be 1px apart; the 4 horizontal ones stay.
      const coords = (tree as PathDrawCommand[]).map((p) => (p.path as { coords: ArrayLike<number> }).coords);
      expect(coords.every((c) => c[1] === c[3])).toBe(true);
      expect(tree).toHaveLength(4);
    });
  });
});
