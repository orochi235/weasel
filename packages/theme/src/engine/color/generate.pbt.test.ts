/**
 * Property tests of the palette generator: a palette holds one swatch per color asked for, anchors first by name and
 * exactly as previewed, and a palette it calls feasible meets every gate it was given, measured as its stats measure.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { DEFAULT_CONSTRAINTS, floorDegrees, generate, toHexPreview, type Constraints } from './generate';

const RUNS = 60;

const anchor = fc.record({
  name: fc.constantFrom('brand', 'warn', 'toString'),
  hue: fc.integer({ min: 0, max: 359 }),
  lightness: fc.integer({ min: 30, max: 95 }).map((n) => n / 100),
  chroma: fc.option(fc.integer({ min: 0, max: 30 }).map((n) => n / 100), { nil: undefined }),
}, { requiredKeys: ['name', 'hue', 'lightness'] });

const constraints: fc.Arbitrary<Constraints> = fc.record({
  count: fc.integer({ min: 0, max: 7 }),
  hueFloor: fc.constantFrom(0, 0.5, 0.9),
  minContrast: fc.constantFrom(0, 3, 4.5),
  minSurfaceDistance: fc.constantFrom(0, 0.25),
  minDistance: fc.constantFrom(0, 0.1, 0.22),
  surface: fc.constantFrom('#181a1e', '#ffffff', '#808080'),
  lightnessPull: fc.constantFrom(0, 0.4, 1),
  equalize: fc.constant(0),
  order: fc.constantFrom('hue' as const, 'farthest' as const),
  anchors: fc.array(anchor, { maxLength: 2 }),
}).map((c) => ({ ...DEFAULT_CONSTRAINTS, ...c }));

describe('generate', () => {
  it('holds a swatch per color asked for, each anchor as previewed under its own name', () => {
    fc.assert(fc.property(constraints, (c) => {
      const { swatches } = generate(c);
      expect(swatches).toHaveLength(Math.max(c.count, c.anchors.length));
      for (const s of swatches) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/i);
      const anchored = swatches.filter((s) => s.anchored);
      expect(anchored.map((s) => s.name).sort()).toEqual(c.anchors.map((a) => a.name).sort());
      expect(anchored.map((s) => s.hex).sort()).toEqual(c.anchors.map(toHexPreview).sort());
    }), runs(RUNS));
  }, timeoutFor(RUNS, 400));

  it('a feasible palette meets every gate, as its stats measure it', () => {
    const t = tally();
    fc.assert(fc.property(constraints, (c) => {
      const { swatches, stats, feasible } = generate(c);
      if (!feasible || swatches.length === 0) return;
      t.count('feasible');
      const slack = 1e-9;
      if (c.minContrast > 0) expect(stats.minContrast).toBeGreaterThanOrEqual(c.minContrast - slack);
      if (c.minSurfaceDistance > 0) expect(stats.minSurfaceDistance).toBeGreaterThanOrEqual(c.minSurfaceDistance - slack);
      if (c.minDistance > 0 && swatches.length > 1) expect(stats.minDistance).toBeGreaterThanOrEqual(c.minDistance - slack);
      if (c.hueFloor > 0 && swatches.length > 1) expect(stats.minHueGap).toBeGreaterThanOrEqual(floorDegrees(c) - slack);
    }), runs(RUNS));
    t.atLeast('feasible', 10);
  }, timeoutFor(RUNS, 400));
});
