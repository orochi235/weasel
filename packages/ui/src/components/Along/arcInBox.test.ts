import { describe, expect, it } from 'vitest';
import { arcInBox } from './arcInBox';

describe('arcInBox', () => {
  it('sizes an arc to the box\'s inscribed circle less its inset', () => {
    expect(arcInBox({ start: 240, end: 120, direction: 'ccw', inset: 12 }, { width: 200, height: 160 }))
      .toEqual({ center: { x: 100, y: 80 }, radius: 68, start: 240, end: 120, direction: 'ccw' });
  });

  it('lets an explicit radius and center win over the box', () => {
    expect(arcInBox({ start: 0, end: 90, radius: 40, center: { x: 5, y: 6 } }, { width: 200, height: 200 }))
      .toMatchObject({ center: { x: 5, y: 6 }, radius: 40 });
  });

  it('lays a span in degrees either side of where its middle faces, in the arc’s direction', () => {
    expect(arcInBox({ at: 0, span: '120deg' }, { width: 200, height: 200 })).toMatchObject({ start: 300, end: 60 });
    expect(arcInBox({ at: 180, span: '120deg', direction: 'ccw' }, { width: 200, height: 200 })).toMatchObject({ start: 240, end: 120 });
  });

  it('turns a px span into the degrees that reach that far on the arc’s radius', () => {
    const { start, end, radius } = arcInBox({ at: 0, span: '100px' }, { width: 200, height: 200 });
    expect(radius).toBe(100);
    // 100 px on radius 100 is one radian.
    expect(end).toBeCloseTo(90 / Math.PI);
    expect(start).toBeCloseTo(360 - 90 / Math.PI);
  });

  it('keeps a px span the same length as the box grows', () => {
    const small = arcInBox({ at: 0, span: '100px' }, { width: 200, height: 200 });
    const large = arcInBox({ at: 0, span: '100px' }, { width: 400, height: 400 });
    expect(((large.end * Math.PI) / 180) * large.radius).toBeCloseTo(((small.end * Math.PI) / 180) * small.radius);
  });

  it('caps a span at a whole circle, and keeps a span of nothing from becoming one', () => {
    const whole = arcInBox({ at: 90, span: '400deg' }, { width: 200, height: 200 });
    expect(whole.start).toBe(whole.end);
    const none = arcInBox({ at: 90, span: '0px' }, { width: 200, height: 200 });
    expect(none.start).not.toBe(none.end);
  });

  it('gives radius 0, never negative, for a box smaller than its inset', () => {
    expect(arcInBox({ start: 0, end: 90, inset: 30 }, { width: 40, height: 40 }).radius).toBe(0);
  });
});
