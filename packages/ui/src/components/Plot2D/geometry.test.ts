import { describe, expect, it } from 'vitest';
import {
  clientToPlotPoint, modelToPlot, plotToModel,
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

describe('clientToPlotPoint', () => {
  it('scales a rect drawn at another size by its size', () => {
    expect(clientToPlotPoint({ clientX: 210, clientY: 60 }, { left: 10, top: 10, width: 400, height: 200 }, P)).toEqual({ x: 100, y: 25 });
  });

  it('maps through the letterbox a rect of another shape draws the plot in, centered and scaled alike on both axes', () => {
    // 600 by 100 fits the 200 by 100 plot at 1x, 200 px in from either side.
    const rect = { left: 0, top: 0, width: 600, height: 100 };
    expect(clientToPlotPoint({ clientX: 200, clientY: 0 }, rect, P)).toEqual({ x: 0, y: 0 });
    expect(clientToPlotPoint({ clientX: 400, clientY: 100 }, rect, P)).toEqual({ x: 200, y: 100 });
  });
});
