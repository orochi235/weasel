import { hitPredicate } from '@weasel-js/gestures';

/** Whatever is under the press, the document's chrome included, but not UI floating over the canvas (a hit that
 *  `floats`, the HUD's). A tool that acts on the view or reads the document through chrome (the hand, the
 *  eyedropper) targets it to stay a candidate under an exclusive claim, where its tier then outranks the chrome's
 *  ambient binding. */
export const THROUGH_CHROME = {
  kindOf: hitPredicate((hit) => (hit as { floats?: boolean } | null | undefined)?.floats !== true),
};
