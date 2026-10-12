/** Where a score sits on the three axes it is steered by. Values outside a
 *  range are read as its nearest end. */
export interface ScoreMood {
  /** -1 dark to 1 bright. */
  valence: number;
  /** 0 consonant and settled to 1 dissonant. */
  tension: number;
  /** 0 still to 1 driving. */
  urgency: number;
}

/** The scoring devices of factual screen content that a mood can land on. */
export type ScoreCueName = 'dread' | 'investigation' | 'wonder' | 'urgency';

/** One named device: the mood that produces it, and what it does to a listener
 *  in words, for a consumer to show beside the score. */
export interface ScoreCue {
  name: ScoreCueName;
  mood: ScoreMood;
  device: string;
}

export const scoreCues: readonly ScoreCue[] = [
  {
    name: 'dread',
    mood: { valence: -1, tension: 1, urgency: 0 },
    device: 'Sustained low tones a minor second and a tritone apart, with no pulse.',
  },
  {
    name: 'investigation',
    mood: { valence: -0.4, tension: 0.5, urgency: 0.5 },
    device: 'A plucked minor ostinato that adds a layer every two bars.',
  },
  {
    name: 'wonder',
    mood: { valence: 1, tension: 0.1, urgency: 0.1 },
    device: 'Lydian chords in open voicings, swelling in with a soft attack.',
  },
  {
    name: 'urgency',
    mood: { valence: 0, tension: 0.7, urgency: 1 },
    device: 'Driving sixteenths on stacked fourths and fifths, a new chord every bar.',
  },
];

/** Which cue a mood is applying: the nearest, and how much of each. */
export interface ScoreCueReading {
  name: ScoreCueName;
  /** Each cue's share, summing to 1. A mood at a cue's own `mood` is all that cue. */
  weights: Record<ScoreCueName, number>;
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

const inRange = (mood: ScoreMood): ScoreMood => ({
  valence: clamp(mood.valence, -1, 1),
  tension: clamp(mood.tension, 0, 1),
  urgency: clamp(mood.urgency, 0, 1),
});

/** Name the cue a mood is applying, and weigh the others against it by
 *  inverse squared distance. */
export function readScoreCue(mood: ScoreMood): ScoreCueReading {
  const m = inRange(mood);
  // Valence spans twice what the other axes do.
  const distance = scoreCues.map((cue) =>
    ((m.valence - cue.mood.valence) / 2) ** 2 + (m.tension - cue.mood.tension) ** 2 + (m.urgency - cue.mood.urgency) ** 2);
  const exact = distance.indexOf(0);
  const raw = distance.map((d, i) => (exact >= 0 ? Number(i === exact) : 1 / d));
  const total = raw.reduce((sum, w) => sum + w, 0);
  const weights = {} as Record<ScoreCueName, number>;
  scoreCues.forEach((cue, i) => { weights[cue.name] = raw[i] / total; });
  return { name: scoreCues[raw.indexOf(Math.max(...raw))].name, weights };
}

/** The modes a score draws on, brightest first. */
export type ScoreMode = 'lydian' | 'ionian' | 'dorian' | 'aeolian' | 'phrygian';

/** Each mode's seven tones, in semitones above its tonic. */
export const scoreModes: Record<ScoreMode, readonly number[]> = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

/** The musical parameters a mood resolves to. Each follows one axis only. */
export interface ScoreParams {
  /** From valence. */
  mode: ScoreMode;
  /** MIDI note of the tonic the chords are built up from. From valence. */
  register: number;
  /** Octaves a chord is opened across, 1 to 3. From valence. */
  spread: number;
  /** How the tones above a root are chosen: thirds from the mode, stacked
   *  fourths and fifths, or a minor second and a tritone. From tension. */
  harmony: 'triadic' | 'quartal' | 'cluster';
  /** The most layers a pulsed score builds up to. From tension. */
  layers: number;
  /** Beats per minute. From urgency. */
  tempo: number;
  /** Notes to a beat; 0 is no pulse at all. From urgency. */
  density: 0 | 1 | 2 | 4;
  /** From urgency. */
  articulation: 'sustained' | 'plucked';
  /** Bars a chord lasts. From urgency. */
  harmonicRhythm: number;
  /** Envelope attack in ms. From urgency. */
  attack: number;
}

/** Resolve a mood to the parameters `scoreBar` writes music from. */
export function scoreParams(mood: ScoreMood): ScoreParams {
  const { valence, tension, urgency } = inRange(mood);
  const sustained = urgency < 0.35;
  return {
    mode: valence > 0.6 ? 'lydian'
      : valence > 0.2 ? 'ionian'
      : valence > -0.2 ? 'dorian'
      : valence > -0.6 ? 'aeolian'
      : 'phrygian',
    register: 36 + 12 * Math.round(valence + 1),
    spread: 1 + Math.round(2 * Math.max(0, valence)),
    harmony: tension >= 0.8 ? 'cluster' : tension >= 0.55 ? 'quartal' : 'triadic',
    layers: 1 + Math.round(4 * tension),
    tempo: Math.round(60 + 80 * urgency),
    density: urgency < 0.15 ? 0 : urgency < 0.4 ? 1 : urgency < 0.75 ? 2 : 4,
    articulation: sustained ? 'sustained' : 'plucked',
    harmonicRhythm: urgency < 0.33 ? 4 : urgency < 0.66 ? 2 : 1,
    attack: sustained ? Math.round(800 * (1 - urgency)) : 5,
  };
}
