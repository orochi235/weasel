/** A pitch: hertz as a number, a scientific pitch name (`'A4'`, `'C#3'`,
 *  `'Bb2'`), or a MIDI note number wrapped as `{ midi }` so it cannot be read
 *  as hertz. */
export type Pitch = number | string | { midi: number };

/** Equal temperament, A4 = MIDI 69 = 440 Hz. Fractional notes are cents. */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const LETTERS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** MIDI number of a scientific pitch name: C4 is 60. Accepts any run of `#`
 *  or `b` after the letter. */
export function noteToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]*)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`@weasel-js/audio: cannot read "${name}" as a note name`);
  let semitone = LETTERS[m[1].toLowerCase()];
  for (const acc of m[2]) semitone += acc === '#' ? 1 : -1;
  return (Number(m[3]) + 1) * 12 + semitone;
}

export function toFrequency(pitch: Pitch): number {
  const hz = typeof pitch === 'number' ? pitch
    : typeof pitch === 'string' ? midiToFrequency(noteToMidi(pitch))
    : midiToFrequency(pitch.midi);
  if (!(hz > 0) || !Number.isFinite(hz)) {
    throw new RangeError(`@weasel-js/audio: a pitch must be a positive frequency, got ${hz}`);
  }
  return hz;
}
