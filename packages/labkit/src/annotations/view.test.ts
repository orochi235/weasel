import { describe, expect, it } from 'vitest';
import { fitView, fromWeaselView, toWeaselView } from './view';

describe('fitView', () => {
  it("scales a target's content box to the box it is drawn in", () => {
    expect(fitView({ width: 256, height: 170 }, { width: 512, height: 340 })).toEqual({
      zoom: 2,
      pan: { x: 0, y: 0 },
    });
  });

  it('takes the smaller axis, so nothing is drawn past the pane', () => {
    expect(fitView({ width: 256, height: 170 }, { width: 512, height: 170 })).toEqual({
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  });

  it('reads zoom 1 from a degenerate content box rather than Infinity', () => {
    expect(fitView({ width: 0, height: 0 }, { width: 512, height: 340 })).toEqual({
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  });
});

describe('fitView over the part of the content a target shows', () => {
  it('fits that part to the pane and pans its corner to the origin', () => {
    expect(
      fitView(
        { width: 300, height: 900 },
        { width: 600, height: 400 },
        { x: 0, y: 150, width: 300, height: 200 },
      ),
    ).toEqual({
      zoom: 2,
      pan: { x: 0, y: -300 },
    });
  });

  it('is the whole-box camera when that part is the whole box', () => {
    const content = { width: 256, height: 170 };
    expect(fitView(content, { width: 512, height: 340 }, { x: 0, y: 0, ...content })).toEqual(
      fitView(content, { width: 512, height: 340 }),
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
