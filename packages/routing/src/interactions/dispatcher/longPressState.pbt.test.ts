/**
 * Property test of a held press's progress: at any clock reading, start, and duration, edge values and ones that
 * are no number among them, it reads between 0 and 1, and never goes back as the clock goes on.
 */
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { runs } from '../../pbt.fixture';
import { createLongPressStore, type PendingLongPress } from './longPressState';

const time = fc.oneof(fc.double(), fc.constantFrom(0, -0, 1e-310, 1e300, NaN, Infinity, -Infinity));
const pending = (startedAt: number, duration: number): PendingLongPress => ({
  pointerId: 1, pointerType: 'touch', client: { x: 0, y: 0 }, local: { x: 0, y: 0 }, world: { x: 0, y: 0 },
  viewId: null, startedAt, duration, armed: true,
});

it('reads a held press\'s progress between 0 and 1, never going back as the clock goes on', () => {
  fc.assert(fc.property(time, time, fc.array(time, { minLength: 1, maxLength: 6 }), (startedAt, duration, nows) => {
    const store = createLongPressStore();
    expect(store.progress(0)).toBe(0);
    store.set(pending(startedAt, duration));
    const read = nows.filter((n) => !Number.isNaN(n)).sort((a, b) => a - b).map((n) => store.progress(n));
    for (const p of [...read, ...nows.map((n) => store.progress(n))]) {
      expect(p >= 0 && p <= 1, `${p} at ${startedAt} + ${duration}`).toBe(true);
    }
    for (let i = 1; i < read.length; i++) expect(read[i]).toBeGreaterThanOrEqual(read[i - 1]!);
  }), runs(1_000));
});
