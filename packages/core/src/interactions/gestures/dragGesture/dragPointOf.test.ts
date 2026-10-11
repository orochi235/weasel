import { describe, expect, it } from 'vitest';
import { dragPointOf } from './dragPointOf';

const el = { getBoundingClientRect: () => ({ left: 100, top: 40 }) };

describe('dragPointOf', () => {
  it('reads world coordinates as the element-local position when given no view', () => {
    expect(dragPointOf({ clientX: 130, clientY: 90 }, el)).toEqual({
      clientX: 130, clientY: 90, worldX: 30, worldY: 50,
    });
  });

  it('takes the position through a view', () => {
    const view = { x: 5, y: -5, scale: { x: 2, y: 4 } };
    expect(dragPointOf({ clientX: 130, clientY: 90 }, el, view)).toEqual({
      clientX: 130, clientY: 90, worldX: 20, worldY: 7.5,
    });
  });
});
