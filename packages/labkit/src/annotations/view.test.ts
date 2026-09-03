import { describe, expect, it } from 'vitest';
import { fitView, fromWeaselView, toWeaselView } from './view';

describe('fitView', () => {
  it("scales a target's content box to the box it is drawn in", () => {
    expect(fitView({ w: 256, h: 170 }, { w: 512, h: 340 })).toEqual({
      zoom: 2,
      pan: { x: 0, y: 0 },
    });
  });

  it('takes the smaller axis, so nothing is drawn past the pane', () => {
    expect(fitView({ w: 256, h: 170 }, { w: 512, h: 170 })).toEqual({
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  });

  it('reads zoom 1 from a degenerate content box rather than Infinity', () => {
    expect(fitView({ w: 0, h: 0 }, { w: 512, h: 340 })).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  });
});

describe('view conversion', () => {
  it("round-trips a target's camera through weasel's shape", () => {
    const v = { zoom: 1.5, pan: { x: -12, y: 40 } };
    expect(fromWeaselView(toWeaselView(v))).toEqual(v);
  });

  it("puts the pan in weasel's translation and the zoom in both scale axes", () => {
    expect(toWeaselView({ zoom: 2, pan: { x: 10, y: -5 } })).toEqual({
      x: 10,
      y: -5,
      scale: { x: 2, y: 2 },
    });
  });
});
