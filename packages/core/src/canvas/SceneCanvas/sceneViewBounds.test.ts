import { describe, it, expect } from 'vitest';
import { contentReach, sceneViewBounds, DEFAULT_CONTENT_MARGIN } from './sceneViewBounds';
import type { View } from 'core/viewport/view';

const DIMS = { width: 100, height: 100 };
const at = (x: number, y: number, scale = 1): View => ({ x, y, scale: { x: scale, y: scale } });
const CONTENT = { x: 0, y: 0, width: 50, height: 50 };

describe('contentReach', () => {
  it('grows the content by the margin in screen pixels, so less world the further in the view is zoomed', () => {
    expect(contentReach(CONTENT, 20, at(0, 0), DIMS)).toEqual({ x: -20, y: -20, width: 120, height: 120 });
    expect(contentReach(CONTENT, 20, at(0, 0, 4), DIMS)).toEqual({ x: -5, y: -5, width: 60, height: 60 });
  });

  it('takes in what the view already shows, so a view outside never has to move', () => {
    expect(contentReach(CONTENT, 0, at(500, 0), DIMS)).toEqual({ x: 0, y: 0, width: 600, height: 100 });
  });

  it('reads a flipped axis the way it runs', () => {
    expect(contentReach(CONTENT, 0, { x: 0, y: 0, scale: { x: -1, y: 1 } }, DIMS)).toEqual({ x: -100, y: 0, width: 150, height: 100 });
  });

  it('bounds nothing with no content', () => {
    expect(contentReach(null, 20, at(0, 0), DIMS)).toBeNull();
  });
});

describe('sceneViewBounds', () => {
  it('passes a world rect through and leaves no prop unbounded', () => {
    expect(sceneViewBounds(CONTENT, () => null)).toBe(CONTENT);
    expect(sceneViewBounds(undefined, () => CONTENT)).toBeUndefined();
  });

  it("reads the content at each write for 'content', with the default margin", () => {
    let content = CONTENT;
    const of = sceneViewBounds('content', () => content) as (v: View, d: typeof DIMS) => unknown;
    const m = DEFAULT_CONTENT_MARGIN;
    expect(of(at(0, 0, m / 10), DIMS)).toEqual({ x: -10, y: -10, width: 70, height: 70 });
    content = { x: 0, y: 0, width: 80, height: 50 };
    expect(of(at(0, 0, m / 10), DIMS)).toEqual({ x: -10, y: -10, width: 100, height: 70 });
  });

  it('counts the rects it is told to include as content, so an empty scene still has bounds', () => {
    const of = sceneViewBounds({ content: { margin: 0, include: [CONTENT] } }, () => null) as (v: View, d: typeof DIMS) => unknown;
    expect(of(at(0, 0, 4), DIMS)).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });
});
