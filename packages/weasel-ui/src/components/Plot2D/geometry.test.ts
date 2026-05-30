import { describe, expect, it } from 'vitest';
import {
  modelToPlot, plotToModel,
  type ModelRange, type PlotSize,
} from './geometry';

const M: ModelRange = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
const P: PlotSize = { width: 200, height: 100 };

describe('modelToPlot / plotToModel', () => {
  it('maps (0,0) to bottom-left of plot', () => {
    const p = modelToPlot({ x: 0, y: 0 }, M, P);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(100, 6);
  });

  it('maps (1,1) to top-right of plot', () => {
    const p = modelToPlot({ x: 1, y: 1 }, M, P);
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('round-trips model → plot → model', () => {
    const m = { x: 0.37, y: 0.62 };
    const p = modelToPlot(m, M, P);
    const m2 = plotToModel(p, M, P);
    expect(m2.x).toBeCloseTo(m.x, 10);
    expect(m2.y).toBeCloseTo(m.y, 10);
  });

  it('handles non-unit ranges', () => {
    const M2: ModelRange = { xMin: -5, xMax: 5, yMin: 0, yMax: 100 };
    const p = modelToPlot({ x: 0, y: 50 }, M2, P);
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(50, 6);
  });
});
