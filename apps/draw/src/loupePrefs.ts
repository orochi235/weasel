import type { LoupeMode } from '@weasel-js/hud';
import { pref } from '@weasel-js/prefs';

/** How the loupe magnifies, kept across sessions: the preferences dialog and the loupe asset both draw it. */
export const LOUPE_MODE = pref.enum<LoupeMode>('Mode', 'vector', ['vector', 'pixel'], {
  control: 'toggle',
  description: 'Vector redraws the canvas at the loupe\'s magnification; pixel enlarges the pixels on screen.',
});

/** How far the loupe magnifies, kept across sessions. */
export const LOUPE_FACTOR = pref.number('Magnification', 8, {
  min: 2, max: 16, step: 1, short: ['Zoom'], description: 'How many times the loupe enlarges what is under it.',
});
