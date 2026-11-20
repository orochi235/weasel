import { describe, expect, it } from 'vitest';
import { SegmentIndex } from './segments';

/** Another connector's vertical run on x = 50 and horizontal run on y = 50. */
function index(): SegmentIndex {
  const i = new SegmentIndex();
  i.add('other', [{ x: 50, y: -100 }, { x: 50, y: 100 }]);
  i.add('across', [{ x: -100, y: 50 }, { x: 100, y: 50 }]);
  return i;
}

describe('SegmentIndex.crossings', () => {
  it('counts a crossing once when two steps meet on the crossed run', () => {
    const i = index();
    expect(i.crossings('me', 0, 0, 50, 0) + i.crossings('me', 50, 0, 100, 0)).toBe(1);
    expect(i.crossings('me', 100, 0, 50, 0) + i.crossings('me', 50, 0, 0, 0)).toBe(1);
    expect(i.crossings('me', 0, 0, 0, 50) + i.crossings('me', 0, 50, 0, 80)).toBe(1);
    expect(i.crossings('me', 0, 80, 0, 50) + i.crossings('me', 0, 50, 0, 0)).toBe(1);
  });

  it('counts a step that runs across a run inside it', () => {
    expect(index().crossings('me', 0, 0, 100, 0)).toBe(1);
  });

  it('counts no crossing of a connector’s own route, nor of a run the step only reaches the end of', () => {
    const i = index();
    expect(i.crossings('other', 0, 0, 100, 0)).toBe(0);
    expect(i.crossings('me', 0, 100, 100, 100)).toBe(0);
  });
});
