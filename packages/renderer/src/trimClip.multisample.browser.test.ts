/**
 * A trimmed stroke clipped in the shader against the same stroke rebuilt trimmed on the CPU, on a
 * multisampled canvas (`./testing/trimClip.ts` says what may differ).
 */
import { describe } from 'vitest';
import { capCases, disposeAfterEach } from '@weasel-js/renderer/testing/trimClip';

disposeAfterEach();

describe('a trimmed stroke clipped in the shader, multisampled', () => {
  capCases(true);
});
