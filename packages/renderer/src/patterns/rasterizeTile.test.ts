import { describe, expect, it, vi } from 'vitest';
import { rasterizeTile } from './rasterizeTile';

describe('rasterizeTile with no OffscreenCanvas', () => {
  it('gives no bitmap and draws nothing', () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    try {
      const draw = vi.fn();
      expect(rasterizeTile({ size: 8, draw })).toBeNull();
      expect(draw).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
