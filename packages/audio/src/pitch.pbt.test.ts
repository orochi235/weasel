/**
 * Pitch names and frequencies: a name's MIDI number moves by a semitone per accidental and by twelve per octave,
 * enharmonic spellings agree, MIDI and hertz round-trip, and any text either reads as a positive finite frequency
 * or throws the package's own error.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { midiToFrequency, noteToMidi, toFrequency } from './pitch';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const letter = fc.constantFrom(...Object.keys(SEMITONE));
const accidentals = fc.array(fc.constantFrom('#', 'b'), { maxLength: 4 }).map((a) => a.join(''));
const octave = fc.integer({ min: -2, max: 10 });

describe('noteToMidi', () => {
  it('counts a semitone per accidental and twelve per octave, in either case and around spaces', () => {
    fc.assert(fc.property(letter, accidentals, octave, fc.boolean(), (l, acc, oct, lower) => {
      const shift = [...acc].reduce((n, a) => n + (a === '#' ? 1 : -1), 0);
      const name = `${lower ? l.toLowerCase() : l}${acc}${oct}`;
      expect(noteToMidi(name)).toBe((oct + 1) * 12 + SEMITONE[l]! + shift);
      expect(noteToMidi(` ${name}\t`)).toBe(noteToMidi(name));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('agrees across enharmonic spellings', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 127 }), (midi) => {
      const names = Object.entries(SEMITONE).flatMap(([l, s]) => {
        for (let oct = -2; oct <= 10; oct += 1) {
          const d = midi - ((oct + 1) * 12 + s);
          if (Math.abs(d) <= 2) return [`${l}${(d > 0 ? '#' : 'b').repeat(Math.abs(d))}${oct}`];
        }
        return [];
      });
      expect(names.length).toBeGreaterThanOrEqual(2);
      for (const n of names) expect(noteToMidi(n), n).toBe(midi);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('midiToFrequency', () => {
  it('rises with the note, doubles an octave up, and reads back as the note it came from', () => {
    fc.assert(fc.property(fc.double({ min: -200, max: 300, noNaN: true }), fc.double({ min: 0, max: 50, noNaN: true }), (midi, up) => {
      const hz = midiToFrequency(midi);
      expect(hz).toBeGreaterThan(0);
      expect(midiToFrequency(midi + up)).toBeGreaterThanOrEqual(hz);
      expect(midiToFrequency(midi + 12) / hz).toBeCloseTo(2, 12);
      expect(69 + 12 * Math.log2(hz / 440)).toBeCloseTo(midi, 9);
      expect(toFrequency({ midi })).toBe(hz);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('toFrequency', () => {
  it('reads any text as a positive finite frequency or throws the package error', () => {
    const seen = tally();
    const text = fc.oneof(
      fc.string({ maxLength: 8 }),
      fc.tuple(letter, accidentals, fc.oneof(octave, fc.integer(), fc.constantFrom(-0, 1e21, -1e21))).map(([l, a, o]) => `${l}${a}${o}`),
      fc.array(fc.constantFrom('A', 'b', '#', '-', '4', '0', ' ', 'x', '9'), { maxLength: 6 }).map((a) => a.join('')),
    );
    fc.assert(fc.property(text, (s) => {
      let hz: number;
      try {
        hz = toFrequency(s);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/^@weasel-js\/audio: /);
        seen.count('refused');
        return;
      }
      expect(hz > 0 && Number.isFinite(hz)).toBe(true);
      expect(hz).toBe(midiToFrequency(noteToMidi(s)));
      seen.count('read');
    }), runs(RUNS));
    seen.atLeast('read', RUNS / 10);
    seen.atLeast('refused', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});
