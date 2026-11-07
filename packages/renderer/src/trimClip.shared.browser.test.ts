/**
 * A clipped stroke against itself: trimmed whole against untrimmed, which must match pixel for
 * pixel, and translucent inside everything else that holds the stencil, against the stroke painted
 * once there (`./testing/trimClip.ts` says what may differ).
 */
import { describe } from 'vitest';
import { disposeAfterEach, stencilCases, wholeCases } from '@weasel-js/renderer/testing/trimClip';

disposeAfterEach();

for (const antialias of [false, true]) {
  describe(`a stroke clipped from its cached ribbon${antialias ? ', multisampled' : ''}`, () => {
    wholeCases(antialias);
    stencilCases(antialias);
  });
}
