import { describe, expect, it } from 'vitest';
import { isHiddenAnchor } from './anchorRules';

const points = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5, locked: true }, { x: 1, y: 1 }];

describe('isHiddenAnchor', () => {
  it('keeps a pinned-x endpoint, which still moves in y', () => {
    expect(isHiddenAnchor(points, 0, 'pinned-x', true)).toBe(false);
    expect(isHiddenAnchor(points, 2, 'pinned-x', true)).toBe(false);
  });

  it('hides a pinned-both endpoint and a locked anchor', () => {
    expect(isHiddenAnchor(points, 0, 'pinned-both', true)).toBe(true);
    expect(isHiddenAnchor(points, 1, 'free', true)).toBe(true);
  });
});
