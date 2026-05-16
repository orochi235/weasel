import { describe, it, expect } from 'vitest';
import { SHAPES, ALL_SHAPES } from './index';

describe('shape registry', () => {
  it('lists every supported shape', () => {
    expect(ALL_SHAPES).toEqual([
      'pill', 'square', 'notched', 'perforated',
      'diamond', 'dot', 'hexagon', 'chevron', 'banner',
      'starburst', 'scalloped', 'shield', 'ribbon',
    ]);
  });

  it('each shape entry has Component + insets + stretches', () => {
    for (const name of ALL_SHAPES) {
      const m = SHAPES[name];
      expect(m.Component).toBeDefined();
      expect(m.insets).toMatchObject({ top: expect.any(Number), right: expect.any(Number), bottom: expect.any(Number), left: expect.any(Number) });
      expect(typeof m.stretches).toBe('boolean');
    }
  });
});
