import { describe, it, expect, beforeEach } from 'vitest';
import { outlineStrokeMesh, _resetOutlineStrokeMeshCacheForTests } from './outlineStrokeMeshCache';

const SQUARE = 'M0 0L1 0L1 -1L0 -1Z';
const LINE = 'M0 0L1 -1';

describe('outline stroke mesh cache', () => {
  beforeEach(() => {
    _resetOutlineStrokeMeshCacheForTests();
  });

  it('keys a nib, so a calligraphic outline does not reuse a round pen\'s ribbon', () => {
    const plain = outlineStrokeMesh('k|sq', SQUARE, 0.1, {});
    const nibbed = outlineStrokeMesh('k|sq', SQUARE, 0.1, { nib: { angle: 0, ratio: 0.2 } });
    expect(nibbed).not.toBe(plain);
    expect(Array.from(nibbed!.vertices)).not.toEqual(Array.from(plain!.vertices));
  });

  it('keys a trim, so a trimmed outline does not reuse the whole ribbon', () => {
    const whole = outlineStrokeMesh('k|line', LINE, 0.1, {});
    const half = outlineStrokeMesh('k|line', LINE, 0.1, { trim: { start: 0, end: 0.5 } });
    expect(half).not.toBe(whole);
  });
});
