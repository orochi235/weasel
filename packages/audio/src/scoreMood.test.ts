import { describe, expect, it } from 'vitest';
import { readScoreCue, scoreCues, scoreParams, type ScoreMood } from './scoreMood';

const home = (name: string): ScoreMood => scoreCues.find((c) => c.name === name)!.mood;

describe('readScoreCue', () => {
  it('names each cue at its own home, with the whole weight', () => {
    for (const cue of scoreCues) {
      const reading = readScoreCue(cue.mood);
      expect(reading.name).toBe(cue.name);
      expect(reading.weights[cue.name]).toBe(1);
    }
  });

  it('weighs the cues a mood sits between, summing to 1', () => {
    const a = home('dread');
    const b = home('investigation');
    const mid = {
      valence: (a.valence + b.valence) / 2,
      tension: (a.tension + b.tension) / 2,
      urgency: (a.urgency + b.urgency) / 2,
    };
    const { weights } = readScoreCue(mid);
    expect(weights.dread).toBeCloseTo(weights.investigation, 9);
    expect(weights.dread).toBeGreaterThan(weights.wonder);
    expect(Object.values(weights).reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 9);
  });

  it('reads a mood outside the axes as the nearest one inside', () => {
    expect(readScoreCue({ valence: -9, tension: 9, urgency: -9 }).name).toBe('dread');
  });

  it('says in words what each cue does', () => {
    for (const cue of scoreCues) expect(cue.device.length).toBeGreaterThan(20);
  });
});

describe('scoreParams', () => {
  it('makes dread sustained, low, pulseless and dissonant', () => {
    expect(scoreParams(home('dread'))).toMatchObject({
      density: 0, articulation: 'sustained', harmony: 'cluster', register: 36, mode: 'phrygian',
    });
  });

  it('makes investigation a layered minor ostinato', () => {
    const p = scoreParams(home('investigation'));
    expect(p).toMatchObject({ mode: 'aeolian', articulation: 'plucked', harmony: 'triadic' });
    expect(p.density).toBeGreaterThan(0);
    expect(p.layers).toBeGreaterThan(1);
  });

  it('makes wonder Lydian, open and soft', () => {
    const p = scoreParams(home('wonder'));
    expect(p).toMatchObject({ mode: 'lydian', articulation: 'sustained', harmony: 'triadic' });
    expect(p.spread).toBeGreaterThanOrEqual(2);
    expect(p.attack).toBeGreaterThanOrEqual(200);
  });

  it('makes urgency driving sixteenths on fourths and fifths', () => {
    const p = scoreParams(home('urgency'));
    expect(p).toMatchObject({ density: 4, articulation: 'plucked', harmony: 'quartal', harmonicRhythm: 1 });
    expect(p.tempo).toBeGreaterThanOrEqual(120);
  });

  it('moves each parameter with one axis and no other', () => {
    const base = { valence: 0, tension: 0.5, urgency: 0.5 };
    const p = scoreParams(base);
    const v = scoreParams({ ...base, valence: 1 });
    const t = scoreParams({ ...base, tension: 1 });
    const u = scoreParams({ ...base, urgency: 1 });
    const same = (a: object, b: object, keys: string[]) =>
      expect(keys.map((k) => (a as never)[k])).toEqual(keys.map((k) => (b as never)[k]));
    same(p, v, ['tempo', 'density', 'articulation', 'harmonicRhythm', 'attack', 'harmony', 'layers']);
    same(p, t, ['tempo', 'density', 'articulation', 'harmonicRhythm', 'attack', 'mode', 'register', 'spread']);
    same(p, u, ['mode', 'register', 'spread', 'harmony', 'layers']);
    expect([v.mode, t.harmony, u.tempo]).not.toEqual([p.mode, p.harmony, p.tempo]);
  });
});
