import { describe, expect, it } from 'vitest';
import { envelopeLevel, envelopePoints, resolveEnvelope } from './envelope';

describe('envelope, shrunk from the property tests', () => {
  it('is silent at the end of its release, where rounding put gate + release less than a release past the gate', () => {
    const e = resolveEnvelope({ attack: 5, decay: 0, sustain: 1, release: 1e-9 });
    expect(envelopeLevel(e, 128 + 1e-9, 128)).toBe(0);
  });

  it('rises to the peak and steps to the sustain for a gate on the end of an attack with no decay', () => {
    const e = resolveEnvelope({ attack: 1e300, decay: 0, sustain: 0, release: 30 });
    expect(envelopePoints(e, 1e300)).toEqual([{ at: 0, value: 0 }, { at: 1e300, value: 1 }, { at: 1e300, value: 0 }, { at: 1e300 + 30, value: 0 }]);
    const short = resolveEnvelope({ attack: 5, decay: 0, sustain: 0.5, release: 30 });
    expect(envelopePoints(short, 5)).toEqual([{ at: 0, value: 0 }, { at: 5, value: 1 }, { at: 5, value: 0.5 }, { at: 35, value: 0 }]);
  });
});
