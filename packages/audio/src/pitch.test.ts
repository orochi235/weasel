import { describe, expect, it } from 'vitest';
import { midiToFrequency, noteToMidi, toFrequency } from './pitch';

describe('pitch', () => {
  it('tunes MIDI 69 to A440 and moves an octave per 12', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(57)).toBeCloseTo(220, 9);
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
  });

  it('reads scientific pitch names, with sharps and flats', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('c#4')).toBe(61);
    expect(noteToMidi('Db4')).toBe(61);
    expect(noteToMidi('B#3')).toBe(60);
    expect(noteToMidi('C-1')).toBe(0);
    expect(noteToMidi('Bbb2')).toBe(45);
  });

  it('rejects a name it cannot read', () => {
    expect(() => noteToMidi('H2')).toThrow(/note name/);
    expect(() => noteToMidi('C')).toThrow(/note name/);
  });

  it('takes a pitch as hertz, a name, or a MIDI note', () => {
    expect(toFrequency(330)).toBe(330);
    expect(toFrequency('A4')).toBe(440);
    expect(toFrequency({ midi: 81 })).toBeCloseTo(880, 9);
  });

  it('rejects a frequency that is not positive and finite', () => {
    expect(() => toFrequency(0)).toThrow(RangeError);
    expect(() => toFrequency(Number.NaN)).toThrow(RangeError);
  });
});
