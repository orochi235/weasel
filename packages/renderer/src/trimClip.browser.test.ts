/**
 * A trimmed stroke clipped in the shader against the same stroke rebuilt trimmed on the CPU,
 * single-sampled, and with a dash pattern and heads (`./testing/trimClip.ts` says what may differ).
 * The multisampled cases are `trimClip.multisample.browser.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { strokeInsets } from '@weasel-js/stroke';
import type { CommandStroke, Stroke } from '@weasel-js/paint';
import { capCases, paintCases, cutsOf, disposeAfterEach, edgesOf, frame, offCuts, paint, TRIMS, zigzag } from './testing/trimClip';

disposeAfterEach();

describe('a trimmed stroke clipped in the shader', () => {
  capCases(false);
  paintCases(false);

  it('keeps the dash pattern and the heads where the rebuilt one draws them', () => {
    for (const trim of TRIMS) {
      const stroke: CommandStroke = { width: 6, cap: 'round', dash: [11, 7], markerEnd: 'arrow', paint: { color: '#40c0ff' }, trim };
      const clipped = paint(frame(zigzag, stroke), false, true);
      const rebuilt = paint(frame(zigzag, stroke), false, false);
      expect(clipped.programs).toBe(1);
      const inset = strokeInsets(stroke as Stroke, 6).end;
      const edges = edgesOf(zigzag, stroke, { end: inset });
      expect(offCuts(clipped.px, rebuilt.px, cutsOf(zigzag, trim), edges, 1 / 16, 0), JSON.stringify(trim)).toEqual([]);
    }
  });
});
