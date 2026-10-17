import { compact } from './compact';
import { lanes } from './lanes';
import { nodeGraph } from './nodeGraph';
import { rack } from './rack';

/** The looks that ship, by name. */
export const EFFECT_LOOKS = Object.freeze({ nodeGraph, rack, lanes, compact });
