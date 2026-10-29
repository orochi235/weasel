import { describe, expect, it } from 'vitest';
import { resizeSides, resizeSubject } from './resizeBox';

const BOX = { x: 0, y: 0, width: 100, height: 40 };

/** `BOX` turned by `angle` about the origin. */
const turned = (angle: number) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { bounds: BOX, toWorld: (p: { x: number; y: number }) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }) };
};

const rounded = (sides: ReturnType<typeof resizeSides>) =>
  sides.map(({ axis, side, rate }) => [axis, side, +rate.x.toFixed(6), +rate.y.toFixed(6)]);

describe('resizeSides', () => {
  it('moves the dragged side of an unturned box one for one', () => {
    const s = resizeSubject({ bounds: BOX }, { x: 'min', y: 'free' });
    expect(rounded(resizeSides(s, { x: 0, y: 0 }))).toEqual([['x', 'max', 1, 0]]);
  });

  it('moves the pinned side once the drag flips the box past it', () => {
    const s = resizeSubject({ bounds: BOX }, { x: 'min', y: 'min' });
    expect(rounded(resizeSides(s, { x: -150, y: 0 }))).toEqual([['x', 'min', 1, 0], ['y', 'max', 0, 1]]);
  });

  it('moves a quarter-turned box\'s sides along the other world axis', () => {
    // Local x runs down world y: the dragged east side is the extent's bottom.
    const s = resizeSubject(turned(Math.PI / 2), { x: 'min', y: 'free' });
    expect(rounded(resizeSides(s, { x: 0, y: 0 }))).toEqual([['y', 'max', 0, 1]]);
  });

  it('moves the sides held by every corner a turned corner drag carries, each at its own rate', () => {
    // At 30°, the dragged bottom-right corner holds the bottom side; the
    // top-right corner, moving along local x, the right side; the bottom-left,
    // moving along local y, the left side. The pinned top-left holds the top.
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    const sides = rounded(resizeSides(resizeSubject(turned(Math.PI / 6), { x: 'min', y: 'min' }), { x: 0, y: 0 }));
    const r = (v: number) => +v.toFixed(6);
    expect(sides).toEqual([
      ['x', 'min', r(s * s), r(-s * c)],
      ['x', 'max', r(c * c), r(c * s)],
      ['y', 'max', 0, 1],
    ]);
  });
});
