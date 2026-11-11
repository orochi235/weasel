import { describe, expect, it } from 'vitest';
import { envelopeLevel, resolveEnvelope } from './envelope';

describe('envelope, shrunk from the property tests', () => {
  it('is silent at the end of its release, where rounding put gate + release less than a release past the gate', () => {
    const e = resolveEnvelope({ attack: 5, decay: 0, sustain: 1, release: 1e-9 });
    expect(envelopeLevel(e, 128 + 1e-9, 128)).toBe(0);
  });
});
