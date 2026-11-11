/** Clock readings the long-press progress property test shrank to. */
import { expect, it } from 'vitest';
import { createLongPressStore } from './longPressState';

it('reads progress at a clock of NaN as not begun, rather than as NaN', () => {
  const store = createLongPressStore();
  store.set({
    pointerId: 1, pointerType: 'touch', client: { x: 0, y: 0 }, local: { x: 0, y: 0 }, world: { x: 0, y: 0 },
    viewId: null, startedAt: 0, duration: 500, armed: true,
  });
  expect(store.progress(NaN)).toBe(0);
  expect(store.progress(250)).toBe(0.5);
});
