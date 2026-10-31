import { describe, expect, it } from 'vitest';
import { boundsOfPath } from '@weasel-js/geom';
import { outlinePath, outlineSolid } from '../outline';

const WIDE = { x: 0, y: 0, width: 64, height: 20 };
const TALL = { x: 0, y: 0, width: 20, height: 80 };

const box = (path: Parameters<typeof boundsOfPath>[0]) => {
  const b = boundsOfPath(path);
  return { x: +b.x.toFixed(6), y: +b.y.toFixed(6), width: +b.width.toFixed(6), height: +b.height.toFixed(6) };
};

describe('state outlines', () => {
  it('draws start as a dot filled in its stroke, the largest circle the box holds', () => {
    expect(box(outlinePath('start', WIDE))).toEqual({ x: 22, y: 0, width: 20, height: 20 });
    expect(box(outlineSolid('start', WIDE)!)).toEqual({ x: 22, y: 0, width: 20, height: 20 });
  });

  it('draws end as a ring around a smaller solid dot', () => {
    const dot = box(outlineSolid('end', WIDE)!);
    expect(dot.width).toBeCloseTo(11);
    expect(dot.x + dot.width / 2).toBeCloseTo(32);
  });

  it('draws bar along the box\'s longer side, thin across it', () => {
    expect(box(outlinePath('bar', WIDE))).toEqual({ x: 0, y: 7, width: 64, height: 6 });
    expect(box(outlineSolid('bar', TALL)!)).toEqual({ x: 7, y: 0, width: 6, height: 80 });
  });

  it('fills nothing solid for an outline with no solid part', () => {
    expect(outlineSolid('rect', WIDE)).toBeNull();
  });
});
