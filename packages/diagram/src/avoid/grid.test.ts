import { describe, expect, it } from 'vitest';
import { interestingPoints, searchWindow, within } from './grid';
import { visibilityGraph } from './visibility';

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

const window = { x: -500, y: -500, width: 1000, height: 1000 };

describe('interestingPoints', () => {
  it('takes every obstacle corner and every end', () => {
    const points = interestingPoints(window, [{ x: 0, y: 0, width: 40, height: 20 }], [{ x: -100, y: 10 }]);
    expect(points).toEqual([
      { x: -100, y: 10 }, { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 20 }, { x: 40, y: 20 },
    ]);
  });

  it('adds the middle of a channel between two facing obstacles', () => {
    const boxes = [{ x: 0, y: 0, width: 40, height: 40 }, { x: 100, y: 10, width: 40, height: 40 }];
    expect(interestingPoints(window, boxes, [])).toContainEqual({ x: 70, y: 25 });
  });

  it('adds no middle between obstacles that do not face each other', () => {
    const boxes = [{ x: 0, y: 0, width: 40, height: 40 }, { x: 100, y: 200, width: 40, height: 40 }];
    expect(interestingPoints(window, boxes, []).some((p) => p.x === 70)).toBe(false);
  });

  it('keeps only corners inside the window, but always the ends', () => {
    const points = interestingPoints(window, [{ x: 600, y: 0, width: 40, height: 40 }], [{ x: 700, y: 0 }]);
    expect(points).toEqual([{ x: 700, y: 0 }]);
  });
});

describe('visibilityGraph', () => {
  const wall = { x: 0, y: 0, width: 40, height: 100 };
  const graph = () => visibilityGraph([{ x: -100, y: 50 }, { x: 0, y: 0 }], [wall], window);
  const where = (g: ReturnType<typeof graph>, v: number) => [g.x(v), g.y(v)];

  it('puts a vertex only where two cast lines cross, and links neighbors along each line', () => {
    const g = graph();
    const a = g.at({ x: -100, y: 50 });
    const corner = g.at({ x: 0, y: 0 });
    expect(a).toBeGreaterThanOrEqual(0);
    expect(corner).toBeGreaterThanOrEqual(0);
    // The lines through (-100, 50) and (0, 0) also cross at (-100, 0).
    const up = g.neighbor(a, 3);
    expect(where(g, up)).toEqual([-100, 0]);
    expect(g.neighbor(up, 0)).toBe(corner);
    expect(g.neighbor(up, 3)).toBe(-1);
    expect(g.neighbor(a, 1)).toBe(-1);
  });

  it('stops a line at an obstacle’s inside, and runs it along an edge', () => {
    const g = graph();
    const east = g.neighbor(g.at({ x: -100, y: 50 }), 0);
    expect(where(g, east)).toEqual([0, 50]);
    expect(g.neighbor(east, 0)).toBe(-1);
    expect(g.neighbor(g.at({ x: 0, y: 0 }), 0)).toBe(-1);
    expect(where(g, g.neighbor(east, 3))).toEqual([0, 0]);
  });

  it('drops a point inside an obstacle', () => {
    expect(visibilityGraph([{ x: 20, y: 50 }], [wall], window).at({ x: 20, y: 50 })).toBe(-1);
  });
});
