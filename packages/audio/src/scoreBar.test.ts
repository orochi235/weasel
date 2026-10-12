import { describe, expect, it } from 'vitest';
import { patternVoicePeaks } from './patternLoad';
import { scoreBar, scoreChord } from './scoreBar';
import { scoreCues, scoreModes, scoreParams } from './scoreMood';

const params = (name: string) => scoreParams(scoreCues.find((c) => c.name === name)!.mood);
const midi = (e: { pitch: unknown }) => (e.pitch as { midi: number }).midi;

describe('scoreChord', () => {
  it('voices dread as low tones a minor second and a tritone apart', () => {
    const chord = scoreChord(params('dread'), 0);
    expect(chord.map((n) => n - chord[0])).toEqual([0, 1, 6]);
    expect(Math.max(...chord)).toBeLessThan(48);
  });

  it('stacks urgency in fourths and fifths', () => {
    const chord = scoreChord(params('urgency'), 0);
    const gaps = chord.slice(1).map((n, i) => n - chord[i]);
    expect(gaps.every((g) => g === 5 || g === 7)).toBe(true);
    expect(gaps).toContain(5);
    expect(gaps).toContain(7);
  });

  it('voices wonder open, inside the Lydian scale, with its raised fourth', () => {
    const p = params('wonder');
    const chord = scoreChord(p, 0);
    expect(chord.at(-1)! - chord[0]).toBeGreaterThanOrEqual(24);
    for (const n of chord) expect(scoreModes.lydian).toContain(n % 12);
    expect(chord.map((n) => n % 12)).toContain(6);
  });

  it('keeps every chord of a progression in the mode, and moves the root', () => {
    const p = params('investigation');
    const roots = [0, 1, 2, 3].map((i) => scoreChord(p, i)[0]);
    expect(new Set(roots).size).toBeGreaterThan(1);
    for (let i = 0; i < 4; i++) {
      for (const n of scoreChord(p, i)) expect(scoreModes.aeolian).toContain(n % 12);
    }
    expect(scoreChord(p, 0)[1] - scoreChord(p, 0)[0]).toBe(3);
  });

  it('transposes by the tonic', () => {
    const p = params('urgency');
    expect(scoreChord(p, 0, 2)).toEqual(scoreChord(p, 0).map((n) => n + 2));
  });
});

describe('scoreBar', () => {
  it('holds dread for the whole bar with no pulse', () => {
    const events = scoreBar(params('dread'), 0);
    expect(events.length).toBe(3);
    for (const e of events) expect([e.step, e.length]).toEqual([0, 16]);
    expect(events[0].envelope!.attack).toBeGreaterThanOrEqual(200);
  });

  it('drives urgency on every sixteenth', () => {
    const steps = new Set(scoreBar(params('urgency'), 0).map((e) => e.step));
    expect([...steps].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('adds a layer to investigation every two bars, up to its limit', () => {
    const p = params('investigation');
    const counts = [0, 2, 4, 6, 20].map((bar) => scoreBar(p, bar).length);
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[4]).toBe(counts[3]);
  });

  it('changes chord on the harmonic rhythm', () => {
    const p = params('investigation');
    const low = (bar: number) => Math.min(...scoreBar({ ...p, layers: 1 }, bar).map(midi));
    expect(low(1)).toBe(low(0));
    expect(low(p.harmonicRhythm)).not.toBe(low(0));
  });

  it('is the same bar for the same seed, and another figure for another', () => {
    const p = params('urgency');
    const figure = (seed?: number) => scoreBar({ ...p, layers: 1 }, 0, { seed }).map(midi);
    expect(figure(7)).toEqual(figure(7));
    expect(figure(7)).not.toEqual(figure());
    expect([...figure(7)].sort()).toEqual([...figure()].sort());
  });

  it('routes and scales every note, never past the gain it is given', () => {
    for (const cue of scoreCues) {
      const events = scoreBar(scoreParams(cue.mood), 8, { bus: 'music', gain: 0.4 });
      const byStep = new Map<number, number>();
      for (const e of events) {
        expect(e.bus).toBe('music');
        byStep.set(e.step, (byStep.get(e.step) ?? 0) + e.gain!);
      }
      expect(Math.max(...byStep.values())).toBeLessThanOrEqual(0.4 + 1e-9);
    }
  });

  it('fits every cue in the default voice limit', () => {
    for (const cue of scoreCues) {
      const p = scoreParams(cue.mood);
      const peaks = patternVoicePeaks(scoreBar(p, 8), { tempo: p.tempo, length: 16 });
      expect(peaks.sfx).toBeLessThanOrEqual(32);
    }
  });
});
