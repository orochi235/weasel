import { describe, expect, it } from 'vitest';
import { gridLines, searchWindow, within } from './grid';

describe('searchWindow', () => {
  it('is the box around the points grown by the margin', () => {
    expect(searchWindow([{ x: 0, y: 0 }, { x: 100, y: 50 }], 400)).toEqual({ x: -400, y: -400, width: 900, height: 850 });
  });

  it('knows when it has grown to hold a limit', () => {
    const limit = { x: -1000, y: -1000, width: 2000, height: 2000 };
    expect(within(limit, searchWindow([{ x: 0, y: 0 }], 400))).toBe(false);
    expect(within(limit, searchWindow([{ x: 0, y: 0 }], 1600))).toBe(true);
  });
});

describe('gridLines', () => {
  const window = { x: -500, y: -500, width: 1000, height: 1000 };

  it('takes every obstacle edge and every stop, sorted and distinct', () => {
    const boxes = [{ x: 0, y: 0, width: 40, height: 20 }];
    const { xs, ys } = gridLines(window, boxes, [{ x: -100, y: 10 }, { x: 40, y: 200 }]);
    expect(xs).toEqual([-100, 0, 40]);
    expect(ys).toEqual([0, 10, 20, 200]);
  });

  it('adds the middle of a channel between two facing obstacles', () => {
    const boxes = [{ x: 0, y: 0, width: 40, height: 40 }, { x: 100, y: 10, width: 40, height: 40 }];
    const { xs } = gridLines(window, boxes, []);
    expect(xs).toContain(70);
  });

  it('adds no middle between obstacles that do not face each other', () => {
    const boxes = [{ x: 0, y: 0, width: 40, height: 40 }, { x: 100, y: 200, width: 40, height: 40 }];
    expect(gridLines(window, boxes, []).xs).not.toContain(70);
  });

  it('keeps only obstacle lines inside the window, but always the stops', () => {
    const boxes = [{ x: 600, y: 0, width: 40, height: 40 }];
    const { xs } = gridLines(window, boxes, [{ x: 700, y: 0 }]);
    expect(xs).toEqual([700]);
  });
});
