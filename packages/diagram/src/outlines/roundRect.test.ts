import { afterEach, describe, expect, it } from 'vitest';
import { pathContainsPoint } from '@weasel-js/geom';
import { contentBox, outlinePath, registerOutline } from '../outline';
import { roundRectOutline } from './figures';

const BOX = { x: 0, y: 0, width: 240, height: 160 };
let dispose = () => {};
afterEach(() => dispose());

describe('roundRectOutline', () => {
  it('is what the built-in roundRect is at a radius of 10', () => {
    expect(roundRectOutline(10).path(BOX)).toEqual(outlinePath('roundRect', BOX));
    expect(roundRectOutline(10).content!(BOX)).toEqual(contentBox('roundRect', BOX));
  });

  it('rounds its corners no further than the radius it is given', () => {
    dispose = registerOutline('card', roundRectOutline(5));
    // 4 in from a corner along the diagonal is inside a radius-5 corner and outside a radius-10 one.
    expect(pathContainsPoint(outlinePath('card', BOX), 1.5, 1.5)).toBe(true);
    expect(pathContainsPoint(outlinePath('roundRect', BOX), 1.5, 1.5)).toBe(false);
  });

  it('squares its corners at a radius of 0', () => {
    expect(pathContainsPoint(roundRectOutline(0).path(BOX), 0.1, 0.1)).toBe(true);
  });
});
