import { describe, expect, it } from 'vitest';
import { decodeUrlHash, encodeUrlHash } from './urlHash';

describe('encodeUrlHash / decodeUrlHash', () => {
  it('round-trips a string', () => {
    const original = JSON.stringify({ trials: '[]', saves: '[]' });
    expect(decodeUrlHash(encodeUrlHash(original))).toBe(original);
  });

  it('returns null for an empty or invalid hash', () => {
    expect(decodeUrlHash('')).toBeNull();
    expect(decodeUrlHash('not-base64!!!')).toBeNull();
  });
});
