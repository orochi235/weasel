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

  it('reads a fragment whose base64 something percent-encoded on the way', () => {
    const original = JSON.stringify({ a: '1' });
    const encoded = encodeUrlHash(original);
    expect(encoded).toMatch(/[=+/]/);
    expect(decodeUrlHash(encodeURIComponent(encoded))).toBe(original);
  });
});
