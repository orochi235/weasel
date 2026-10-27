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

describe('fitView over the part of the content a target shows', () => {
  it('fits that part to the pane and pans its corner to the origin', () => {
    expect(
      fitView({ w: 300, h: 900 }, { w: 600, h: 400 }, { x: 0, y: 150, w: 300, h: 200 }),
    ).toEqual({
      zoom: 2,
      pan: { x: 0, y: -300 },
    });
  });

  it('is the whole-box camera when that part is the whole box', () => {
    const content = { w: 256, h: 170 };
    expect(fitView(content, { w: 512, h: 340 }, { x: 0, y: 0, ...content })).toEqual(
      fitView(content, { w: 512, h: 340 }),
    );
  });
});

describe('view conversion', () => {
  it("round-trips a target's camera through weasel's shape", () => {
    const v = { zoom: 1.5, pan: { x: -12, y: 40 } };
    expect(fromWeaselView(toWeaselView(v))).toEqual(v);
  });

  it("turns labkit's screen translation into the world point weasel's view puts at the corner", () => {
    expect(toWeaselView({ zoom: 2, pan: { x: 10, y: -5 } })).toEqual({
      x: -5,
      y: 2.5,
      scale: { x: 2, y: 2 },
    });
  });
});
