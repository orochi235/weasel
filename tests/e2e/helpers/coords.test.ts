import { describe, it, expect } from 'vitest';
import { sceneToCss, type CanvasRect, type ViewLike } from './coords';

const rect: CanvasRect = { left: 100, top: 50, width: 800, height: 600 };

describe('sceneToCss', () => {
  it('identity view: scene point maps to rect.origin + point', () => {
    const view: ViewLike = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    expect(sceneToCss([10, 20], view, rect)).toEqual([110, 70]);
  });

  it('view pan shifts the mapped point in the opposite direction', () => {
    const view: ViewLike = { x: 30, y: 0, scale: { x: 1, y: 1 } };
    expect(sceneToCss([10, 0], view, rect)).toEqual([80, 50]);
  });

  it('view zoom scales the mapped offset', () => {
    const view: ViewLike = { x: 0, y: 0, scale: { x: 2, y: 2 } };
    expect(sceneToCss([10, 20], view, rect)).toEqual([120, 90]);
  });
});
