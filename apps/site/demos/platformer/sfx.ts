import type { AudioEngine, NoiseOptions, NoteOptions, PlayOptions, VoiceHandle } from '@weasel-js/audio';

/** A synth voice `at` ms after the sound is triggered: a note, or noise. */
type TimedVoice = (NoteOptions | NoiseOptions) & { at?: number };

/** A pitch sweep with an optional second harmonic: a 1% attack, full level to
 *  the midpoint, then a linear release over the back half. */
const sweep = (ms: number, from: number, to: number, gain: number, harmonic = 0): NoteOptions => ({
  pitch: from,
  duration: ms / 2,
  gain,
  wave: harmonic ? [1, harmonic] : 'sine',
  envelope: { attack: ms * 0.01, release: ms / 2 },
  ...(from !== to ? { glide: { to, ms, curve: 'linear' as const } } : {}),
});

/** A burst of brown noise `ms` long: `attack` and `release` are fractions of
 *  it, held at full level between. Brown falls 6 dB an octave, which is the
 *  slope of the lowpassed white noise these sounds used to be rendered from. */
const scuff = (
  ms: number, gain: number, attack: number, release: number, filter?: NoiseOptions['filter'],
): NoiseOptions => ({
  noise: 'brown',
  duration: ms * (1 - release),
  gain,
  envelope: { attack: ms * attack, release: ms * release },
  ...(filter ? { filter } : {}),
});

/** Every one-shot, as the synth voices it is made of. */
export const SYNTH_SOUNDS = {
  /** The shelf flattens brown noise below 500 Hz, so the step scuffs rather than booms. */
  step: [scuff(70, 0.66, 0.02, 0.8, { type: 'lowshelf', frequency: 500, gain: -14 })],
  land: [sweep(140, 180, 60, 0.3), scuff(140, 0.1, 0.01, 0.9)],
  jump: [sweep(160, 260, 660, 0.32, 0.25)],
  stomp: [sweep(180, 420, 90, 0.3, 0.4)],
  hurt: [sweep(300, 400, 120, 0.34, 0.5)],
  coin: [sweep(73, 988, 988, 0.28, 0.3), { at: 73, ...sweep(147, 1319, 1319, 0.24, 0.3) }],
  /** C major arpeggio, each note ringing on under the next. */
  goal: [523.25, 659.25, 783.99, 1046.5].map(
    (f, k): TimedVoice => ({ at: k * 225, ...sweep(900 - k * 225, f, f, 0.16, 0.3) }),
  ),
} satisfies Record<string, readonly TimedVoice[]>;
export type SoundName = keyof typeof SYNTH_SOUNDS;

/** Play a sound by name. `opts` applies to every voice, with `gain` scaling
 *  each voice's own. */
export function playSound(engine: AudioEngine, name: SoundName, opts: PlayOptions = {}): VoiceHandle[] {
  const t0 = opts.when ?? engine.now();
  const { loop: _loop, ...shared } = opts;
  return (SYNTH_SOUNDS[name] as readonly TimedVoice[]).map(({ at = 0, ...voice }) => {
    const booked = { ...shared, gain: (voice.gain ?? 1) * (opts.gain ?? 1), when: t0 + at };
    if ('noise' in voice) return engine.playNoise({ ...voice, ...booked });
    const { rate: _rate, ...note } = booked;
    return engine.playNote({ ...voice, ...note });
  });
}
