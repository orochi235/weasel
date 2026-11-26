/** A document's SMIL and CSS animation read into one clip. */
import type { Clip } from '@weasel-js/animator';
import { readSmil } from './smil';
import { readCssAnimations } from './cssAnimation';

/**
 * The clip of every animation under `root`, SMIL's and CSS's together, or undefined for none.
 * It loops when every track repeats forever from 0 on one period; otherwise each that repeats
 * forever is imported as one period, with a warning. Each animated element is entered in
 * `targets` with what it moves.
 */
export function readAnimations(root: Element, warn: (message: string) => void, targets?: Map<Element, Set<string>>): Clip | undefined {
  const smil = readSmil(root, warn, targets);
  const css = readCssAnimations(root, warn, targets);
  if (css.tracks.length === 0) return smil;
  const tracks = [...(smil?.tracks ?? []), ...css.tracks];
  const clip: Clip = { version: 1, tracks };
  const [first] = css.loops;
  const cssLoops = first !== undefined && css.loops.length === css.tracks.length
    && css.loops.every((l) => l.begin === 0 && l.period === first.period);
  const smilAgrees = !smil || (smil.loop === true && smil.duration === first?.period);
  if (cssLoops && smilAgrees) {
    clip.loop = true;
    clip.duration = first.period;
  } else if (css.loops.length > 0) {
    warn(`${css.loops.length} CSS animation(s) repeat forever on periods one clip loop cannot hold; each is imported as one period`);
  }
  return clip;
}
