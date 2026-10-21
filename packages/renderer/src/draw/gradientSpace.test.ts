import { describe, expect, it } from 'vitest';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { sameKey, type RetainedKey } from '../retain/retainedKey';
import type { DrawContext } from './drawContext';
import { gradientSpaceInverse } from './gradient';

const toPixels = mat3.translated(mat3.scaled(mat3.identity(), 2, 2), -10, -20);
const ctx = (screenMatrix?: GlMat3, viewMatrix?: GlMat3) =>
  ({ state: { transform: mat3.identity() }, screenMatrix, viewMatrix }) as unknown as DrawContext;

describe('gradientSpaceInverse', () => {
  it('measures screen-unit paint in the render\'s screen space, when it names one', () => {
    const want = [...mat3.invert(toPixels)!];
    expect([...gradientSpaceInverse(ctx(toPixels), 'screen')!]).toEqual(want);
    expect([...gradientSpaceInverse(ctx(toPixels), undefined)!]).toEqual(want);
    expect([...gradientSpaceInverse(ctx(toPixels), 'world')!]).toEqual(want);
    expect([...gradientSpaceInverse(ctx(), 'screen')!]).toEqual([...mat3.identity()]);
  });

  it('still measures world-unit paint through the view', () => {
    const view = mat3.scaled(mat3.identity(), 3, 3);
    expect([...gradientSpaceInverse(ctx(toPixels, view), 'world')!]).toEqual([...mat3.invert(view)!]);
  });
});

describe('a retained key', () => {
  it('differs when the screen space does', () => {
    const children: RetainedKey['children'] = [];
    const key = (screenMatrix?: GlMat3): RetainedKey => ({
      children, transform: mat3.identity(), alpha: 1, colorMatrix: new Float32Array(20),
      viewMatrix: undefined, screenMatrix, clips: [],
    });
    expect(sameKey(key(toPixels), key(toPixels.slice()))).toBe(true);
    expect(sameKey(key(toPixels), key())).toBe(false);
  });
});
