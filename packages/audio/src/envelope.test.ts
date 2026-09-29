import { describe, expect, it } from 'vitest';
import { envelopeLevel, envelopePoints, resolveEnvelope } from './envelope';

const ENV = resolveEnvelope({ attack: 10, decay: 20, sustain: 0.5, release: 40 });

describe('envelope', () => {
  it('fills defaults that neither click nor drone', () => {
    const d = resolveEnvelope();
    expect(d.attack).toBeGreaterThan(0);
    expect(d.release).toBeGreaterThan(0);
    expect(d.sustain).toBe(1);
  });

  it('rises through the attack, falls through the decay, then holds', () => {
    expect(envelopeLevel(ENV, 0)).toBe(0);
    expect(envelopeLevel(ENV, 5)).toBeCloseTo(0.5);
    expect(envelopeLevel(ENV, 10)).toBe(1);
    expect(envelopeLevel(ENV, 20)).toBeCloseTo(0.75);
    expect(envelopeLevel(ENV, 30)).toBe(0.5);
    expect(envelopeLevel(ENV, 500)).toBe(0.5);
  });

  it('releases from wherever the gate closed', () => {
    // Gate closes mid-attack at 0.5; release spans 40 ms from there.
    expect(envelopeLevel(ENV, 5, 5)).toBeCloseTo(0.5);
    expect(envelopeLevel(ENV, 25, 5)).toBeCloseTo(0.25);
    expect(envelopeLevel(ENV, 45, 5)).toBe(0);
  });

  it('schedules a held note up to its sustain', () => {
    expect(envelopePoints(ENV)).toEqual([
      { at: 0, value: 0 }, { at: 10, value: 1 }, { at: 30, value: 0.5 },
    ]);
  });

  it('schedules a gated note through its release', () => {
    expect(envelopePoints(ENV, 100)).toEqual([
      { at: 0, value: 0 }, { at: 10, value: 1 }, { at: 30, value: 0.5 },
      { at: 100, value: 0.5 }, { at: 140, value: 0 },
    ]);
  });

  it('cuts the attack short when the gate closes inside it', () => {
    expect(envelopePoints(ENV, 5)).toEqual([
      { at: 0, value: 0 }, { at: 5, value: 0.5 }, { at: 45, value: 0 },
    ]);
  });

  it('starts at full level with no attack', () => {
    const e = resolveEnvelope({ attack: 0, decay: 0, sustain: 1, release: 10 });
    expect(envelopePoints(e, 50)).toEqual([
      { at: 0, value: 1 }, { at: 50, value: 1 }, { at: 60, value: 0 },
    ]);
  });
});
