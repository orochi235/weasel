import { describe, expect, it } from 'vitest';
import { toDeviceRect } from './deviceRect';

const onGrid = (v: number, dpr: number) => Math.abs(v * dpr - Math.round(v * dpr)) < 1e-9;

describe('toDeviceRect', () => {
  it('measures y from the bottom of the surface', () => {
    const r = toDeviceRect({ x: 0, y: 0, width: 40, height: 10 }, 100, 1);
    expect(r.y).toBe(90);
    expect(r.height).toBe(10);
  });

  it('leaves x and width alone', () => {
    const r = toDeviceRect({ x: 5, y: 0, width: 40, height: 10 }, 100, 1);
    expect(r.x).toBe(5);
    expect(r.width).toBe(40);
  });

  it('puts every edge on the device grid', () => {
    const r = toDeviceRect({ x: 33.3, y: 7.7, width: 33.3, height: 21.4 }, 100, 2);
    expect(onGrid(r.x, 2)).toBe(true);
    expect(onGrid(r.x + r.width, 2)).toBe(true);
    expect(onGrid(r.y, 2)).toBe(true);
    expect(onGrid(r.y + r.height, 2)).toBe(true);
  });

  it('does not strand a column between neighbours', () => {
    const a = toDeviceRect({ x: 0, y: 0, width: 33.3333, height: 10 }, 100, 2);
    const b = toDeviceRect({ x: 33.3333, y: 0, width: 33.3333, height: 10 }, 100, 2);
    const c = toDeviceRect({ x: 66.6666, y: 0, width: 33.3334, height: 10 }, 100, 2);
    expect(a.x + a.width).toBe(b.x);
    expect(b.x + b.width).toBe(c.x);
  });

  it('snaps a stacked pair without overlapping them', () => {
    const top = toDeviceRect({ x: 0, y: 0, width: 10, height: 33.3333 }, 100, 3);
    const bottom = toDeviceRect({ x: 0, y: 33.3333, width: 10, height: 33.3333 }, 100, 3);
    expect(bottom.y + bottom.height).toBe(top.y);
  });
});
