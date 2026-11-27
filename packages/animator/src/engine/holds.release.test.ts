import { describe, expect, it } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';
import { createTarget } from '../target';
import { createTargetTable } from '../targetTable';

function hosted() {
  let now = 0;
  const h = createHostedAnimator({ now: () => now, requestFrame: () => {} });
  return { animator: h.animator, tick: (t: number) => { now = t; h.tick(t); } };
}

describe('a hold whose setter throws as it commits', () => {
  it('leaves the table on release all the same', () => {
    const a = hosted();
    let fail = false;
    const target = createTarget<number>({ get: () => 0, set: () => { if (fail) throw new Error('set'); } });
    const h = a.animator.hold({ target, value: 5, cancelKey: 'k' });
    fail = true;
    expect(() => h.release()).toThrow('set');
    expect(a.animator.isActive('k')).toBe(false);
  });

  it('lets go of every row of a rows hold, and leaves the table on release', () => {
    const a = hosted();
    let fail = false;
    const table = createTargetTable({ axes: 1, set: (row) => { if (fail && row === 1) throw new Error('set'); } });
    for (let r = 0; r < 4; r++) table.add([r]);
    const h = a.animator.holdRows({ table, cancelKey: 'k' });
    h.values.set([10, 11, 12, 13]);
    h.touch();
    fail = true;
    expect(() => h.release()).toThrow('set');
    expect(a.animator.isActive('k')).toBe(false);
  });
});
