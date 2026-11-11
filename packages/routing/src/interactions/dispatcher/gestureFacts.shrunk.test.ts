/** Angles the gesture facts' property test shrank to. */
import { expect, it } from 'vitest';
import { createGestureFacts } from './gestureFacts';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const touch = (angle: number) => ({ kind: 'multitouch' as const, fingers: 2, angle, ...MODS });

it('skips a multitouch angle that is no number, rather than turning NaN from then on', () => {
  const facts = createGestureFacts();
  facts.begin('g', touch(0));
  facts.turn('g', touch(NaN));
  facts.turn('g', touch(10));
  expect(facts.of('g').rotation).toBe(10);
});

it('turns from the first finite angle of a gesture that opened on none', () => {
  const facts = createGestureFacts();
  facts.begin('g', touch(Infinity));
  facts.turn('g', touch(30));
  facts.turn('g', touch(50));
  expect(facts.of('g').rotation).toBe(20);
});
