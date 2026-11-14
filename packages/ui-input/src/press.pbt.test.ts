/**
 * Property tests of pressing: `pressStep` against a model of a press through downs, moves, ups, cancels, and hovers.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { IDLE_PRESS, pressStep, type PressInput } from './press';

const RUNS = 300;

const input: fc.Arbitrary<PressInput> = fc.oneof(
  fc.constant<PressInput>({ type: 'down' }),
  fc.constantFrom('move' as const, 'up' as const).chain((type) => fc.boolean().map((inside): PressInput => ({ type, inside }))),
  fc.constantFrom<PressInput>({ type: 'cancel' }, { type: 'enter' }, { type: 'leave' }),
);

describe('pressStep — model', () => {
  it('completes a press only on a release over the control it went down on, holding only while over it', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(input, { maxLength: 40 }), (inputs) => {
      let s = IDLE_PRESS;
      const m = { down: false, over: false, hovered: false };
      for (const i of inputs) {
        const { state, pressed } = pressStep(s, i);
        let want = false;
        if (i.type === 'down') { m.down = true; m.over = true; }
        else if (i.type === 'move') m.over = i.inside;
        else if (i.type === 'up') { want = m.down && m.over && i.inside; m.down = false; }
        else if (i.type === 'cancel') m.down = false;
        else m.hovered = i.type === 'enter';
        expect(pressed).toBe(want);
        expect(state).toEqual({ hovered: m.hovered, held: m.down && m.over, down: m.down });
        if (pressed) t.count('pressed');
        s = state;
      }
    }), runs(RUNS));
    t.atLeast('pressed', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});
