/** `kit:text` in the default painters for the tests of one file: what a canvas running `textPreset` paints with. */
import { afterEach, beforeEach } from 'vitest';
import { registerNodeShape } from '@weasel-js/core';
import { TEXT_PAINTER } from '../node/textPainter';

/** Register `kit:text` before each test and release it after. Call it after any hook that resets the painters. */
export function withTextPainter(): void {
  let release: (() => void) | null = null;
  beforeEach(() => { release = registerNodeShape(TEXT_PAINTER); });
  afterEach(() => { release?.(); release = null; });
}
