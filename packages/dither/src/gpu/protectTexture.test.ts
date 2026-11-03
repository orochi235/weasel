import { describe, expect, it } from 'vitest';
import { protectTexture } from './protectTexture';

describe('protectTexture', () => {
  it('refuses a mask of the wrong size before making a bitmap', async () => {
    await expect(protectTexture(new Uint8Array(5), 2, 3)).rejects.toThrow(RangeError);
  });
});
