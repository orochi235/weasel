/**
 * Test seams for `@weasel-js/paint-kinds`. Not consumer surface.
 *
 * @packageDocumentation
 */
import { _resetPaintDrawKindsForTests } from '@weasel-js/renderer/test-seams';
import { _reseedPaintKinds } from './paintKinds';

/** The paint-kind registry, and the renderer's draw half of it, back to the built-ins alone. */
export function _resetPaintKindsForTests(): void {
  _resetPaintDrawKindsForTests();
  _reseedPaintKinds();
}
