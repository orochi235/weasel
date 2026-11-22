import { describe, expect, it } from 'vitest';
import { boxForContent, contentBox } from '../outline';

describe('subprocess', () => {
  it('sizes a box whose content is at least the content asked for', () => {
    for (const c of [{ width: 200, height: 20 }, { width: 40, height: 4 }, { width: 300, height: 200 }, { width: 8, height: 60 }]) {
      const box = boxForContent('subprocess', c);
      const got = contentBox('subprocess', { x: 0, y: 0, ...box });
      expect(got.width, `${c.width}×${c.height}`).toBeGreaterThanOrEqual(c.width - 1e-9);
      expect(got.height, `${c.width}×${c.height}`).toBeGreaterThanOrEqual(c.height - 1e-9);
    }
  });
});
