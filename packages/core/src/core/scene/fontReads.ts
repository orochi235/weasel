/**
 * Glyph outlines as an outside source of the scene's derivations: they land
 * asynchronously, so a derivation that read them re-derives when a face lands.
 * Importing this module registers the face generation, and anything that can
 * note a font read imports it to do so.
 */
import { faceGeneration } from '@weasel-js/font';
import { addOutsideSource, noteOutsideRead } from './outsideReads';

addOutsideSource(faceGeneration);

/** Note that the derivation running now read glyph outlines. */
export function noteFontRead(): void {
  noteOutsideRead();
}
