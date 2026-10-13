import type { PatternDetune, PatternEvent, PatternNoise, PatternNote, SynthPartial } from '@weasel-js/audio';

/**
 * The music bed: four bars at 146 bpm played on junk — oil drums, a trash-can
 * lid, chain for a hi-hat, and pipes for the fill — under root-note bass and
 * off-beat power chords, as events for a pattern player on the `music` bus.
 * Every hit lands late by its own amount, and the loop drifts a few cents
 * sharp and back across its length.
 */

export const BED_TEMPO = 146;
export const BED_BUS = 'music';
const BARS = 4;
const BAR_STEPS = 16;
export const BED_STEPS = BARS * BAR_STEPS;

/** I–V–vi–IV, one bar each. */
const ROOTS = [65.41, 98.0, 110.0, 87.31]; // C2 G2 A2 F2
/** C major, one degree per digit, starting at C5. Index 0 is unused. */
const SCALE = [0, 523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5];

/**
 * One row per bar, sixteen sixteenth-note slots each, `x` for a hit. Four
 * different bars rather than one repeated four times — a loop this short reads
 * as a loop the moment two bars match.
 */
const PATTERN = {
  drum:  ['x.....x...x.....', 'x.....x...x...x.', 'x..x..x...x.....', 'x.....x...x.x.x.'],
  lid:   ['....x.......x...', '....x.....x.x...', '....x.......x..x', '....x.......x.x.'],
  chain: ['x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.', 'x.x.x.x.x.x.xxx.', 'xxxxx.x.xxxxxxxx'],
  /** Off-beat upstrokes. The skank is most of the bounce. */
  skank: ['..x...x...x...x.', '..x...x...x.x.x.', '..x.x.x...x...x.', '..x...x.x.x.....'],
  /** Downstroke power chords, pushed off the beat everywhere but the downbeat. */
  chug:  ['x..x......x.....', 'x..x..x.........', 'x.....x..x......', 'x..x......x.x...'],
  /** Scale degrees for the lead; two bars carry it, two leave air. */
  lead:  ['................', '5.6.5.3.....1...', '................', '..3.5.6.8.6.5.3.'],
} as const;

/** How late a hit can land, as a fraction of a step. Every hit drags a little
 *  and none of them drags the same amount — this is the drunk. */
const DRAG = 0.22;
/** Pitch wander depth. One full cycle per loop, so the wrap stays in tune. */
const WOBBLE = 0.008;

/** The loop's drift in cents at `step`, for the pattern player's `detune`. */
export const bedDetune: PatternDetune = (step) =>
  1200 * Math.log2(1 + WOBBLE * Math.sin((2 * Math.PI * step) / BED_STEPS));

/** 0..1, the same for the same pair every time, and unlike its neighbors'. */
const hash = (a: number, b: number): number =>
  ((Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1 + 1) % 1;

type Voice = Omit<PatternNote, 'step'>;
type Strike = Omit<PatternNoise, 'step'>;

/** A note at `gain` whose partials' levels are `partials`' own, not the engine's
 *  normalized share of 1: the gain is scaled up by what normalizing divides out. */
const summed = (gain: number, partials: SynthPartial[]): Pick<Voice, 'gain' | 'wave'> => ({
  gain: gain * partials.reduce((sum, p) => sum + (p.gain ?? 1), 0),
  wave: { partials },
});

/** Partial ratios well off the harmonic series. This is the whole trick behind
 *  "metal": a bell or a string lands near integers, struck junk does not. */
const CLANK_RATIOS = [1, 1.71, 2.43, 3.19, 4.61, 5.87];

/** The strike's level against its clank's. The engine's noise is quieter than
 *  the full-scale noise the strike was first written with, by this much. */
const STRIKE = 2.5;

/** Struck metal ringing for `decay` ms, and the click of the strike itself. */
const clank = (pitch: number, gain: number, decay: number, length: number): [Voice, Strike] => [
  {
    pitch,
    length,
    bus: BED_BUS,
    envelope: { attack: 1, release: 20 },
    ...summed(gain, CLANK_RATIOS.map((ratio, p) => ({
      ratio, gain: 1 / (1 + p * 0.9), decay: decay / (1 + p * 0.35),
    }))),
  },
  { noise: 'white', length: 0.04, bus: BED_BUS, gain: gain * STRIKE, envelope: { attack: 0, release: 2 } },
];

/** Sum of the first few harmonics at 1/k — a rough saw, which is what makes a
 *  power chord read as a guitar rather than a sine. */
const saw = (ratio: number, level: number, count: number): SynthPartial[] =>
  Array.from({ length: count }, (_, i) => ({ ratio: ratio * (i + 1), gain: (level * 0.5) / (i + 1) }));

/** Partials at one ratio folded into one, each given `decay`. */
const merged = (partials: SynthPartial[], decay: number): SynthPartial[] => {
  const byRatio = new Map<number, number>();
  for (const p of partials) byRatio.set(p.ratio, (byRatio.get(p.ratio) ?? 0) + (p.gain ?? 1));
  return [...byRatio].map(([ratio, gain]) => ({ ratio, gain, decay }));
};

/** A palm-muted power chord: root, fifth, octave, fast attack, short decay. */
const chug = (pitch: number, gain: number, decay: number, length: number): Voice => ({
  pitch,
  length,
  bus: BED_BUS,
  envelope: { attack: 3, release: 20 },
  filter: { frequency: 4700, Q: 0.5 },
  ...summed(gain, merged([...saw(1, 1, 6), ...saw(1.5, 0.8, 6), ...saw(2, 0.45, 6)], decay)),
});

const bass = (pitch: number): Voice => ({
  pitch,
  length: 3,
  bus: BED_BUS,
  envelope: { attack: 4, release: 20 },
  ...summed(0.3, merged([{ ratio: 1, gain: 1 }, ...saw(1, 0.3, 3)], 190)),
});

/** An empty oil drum: a boxy pitch drop, with a metallic ring sitting on top. */
const drum = (pitch: number, gain: number): [Voice, Voice, Strike] => [
  {
    pitch: pitch * 2.4,
    glide: { to: pitch, ms: 40 },
    length: 5,
    bus: BED_BUS,
    gain,
    envelope: { attack: 1, release: 20 },
    wave: { partials: [{ ratio: 1, decay: 150 }] },
  },
  ...clank(pitch * 4.3, gain * 0.18, 100, 5),
];

const TING_STEPS = 0.44;

/** Chain rattle standing in for a hi-hat: a few tiny tings scattered across
 *  two steps rather than one clean tick. */
const rattle = (at: number, gain: number, slot: number): PatternEvent[] =>
  [0, 1, 2, 3].flatMap((k) => {
    const step = (at + hash(slot, 101 + k) * 1.2) % BED_STEPS;
    return clank(2200 + hash(slot, 211 + k) * 2000, gain, 18, TING_STEPS).map((voice) => ({ ...voice, step }));
  });

/** One pass of the bed: every event of its four bars. */
export function bedEvents(): PatternEvent[] {
  const events: PatternEvent[] = [];
  const at = (step: number, ...voices: (Voice | Strike)[]) => {
    for (const voice of voices) events.push({ ...voice, step });
  };

  for (let bar = 0; bar < BARS; bar++) {
    const root = ROOTS[bar];
    for (let k = 0; k < BAR_STEPS; k++) {
      const slot = bar * BAR_STEPS + k;
      const step = slot + hash(bar, k) * DRAG;

      if (PATTERN.drum[bar][k] === 'x') at(step, ...drum(52, 0.42));
      if (PATTERN.lid[bar][k] === 'x') at(step, ...clank(310, 0.16, 110, 6));
      if (PATTERN.chain[bar][k] === 'x') events.push(...rattle(step, k % 4 === 0 ? 0.05 : 0.032, slot));
      if (PATTERN.skank[bar][k] === 'x') at(step, chug(root * 2, 0.07, 90, 3));
      if (PATTERN.chug[bar][k] === 'x') at(step, chug(root, 0.11, 200, 5));

      // The lead is struck metal too, and tuned slightly flat against the chords.
      const degree = PATTERN.lead[bar][k];
      if (degree !== '.') at(step, ...clank(SCALE[Number(degree)] * 0.997, 0.05, 130, 5));

      if (k % 2 === 0) {
        const octave = k % 4 === 2 ? 2 : 1;
        const walk = bar === 3 && k >= 12 ? 1.5 : 1;
        at(step, bass(root * octave * walk));
      }

      // Four pipes of falling pitch over the last beat, handing the loop back
      // to bar one instead of just stopping.
      if (bar === BARS - 1 && k >= 12) at(step, ...clank([430, 360, 305, 255][k - 12], 0.13, 140, 4));
    }
  }
  return events;
}
