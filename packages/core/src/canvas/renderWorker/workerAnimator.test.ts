import { describe, expect, it } from 'vitest';
import type { AnimationOp } from './protocol';
import { workerAnimator } from './workerAnimator';

describe('workerAnimator', () => {
  it('refuses params that cannot cross to the worker, and queues nothing for them', () => {
    const queued: AnimationOp[] = [];
    const animator = workerAnimator((op) => queued.push(op));
    expect(() => animator.play('spin', { onDone: () => {} })).toThrow(/spin/);
    expect(queued).toEqual([]);
  });

  it('queues a play whose params are data', () => {
    const queued: AnimationOp[] = [];
    workerAnimator((op) => queued.push(op)).play('spin', { turns: 2 });
    expect(queued).toEqual([{ op: 'play', id: 1, key: 'spin', params: { turns: 2 } }]);
  });
});
