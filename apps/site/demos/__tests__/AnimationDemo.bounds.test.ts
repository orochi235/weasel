import { describe, expect, it } from 'vitest';
import { flingBounds, INITIAL } from '../AnimationDemo';

describe('AnimationDemo', () => {
  it('stops a flung card with all of it on the canvas', () => {
    const size = { width: 600, height: 400 };
    const b = flingBounds(size);
    for (const card of [...INITIAL, { width: 60, height: 60 }]) {
      expect(b.x + b.width + card.width).toBeLessThanOrEqual(size.width);
      expect(b.y + b.height + card.height).toBeLessThanOrEqual(size.height);
    }
  });
});
