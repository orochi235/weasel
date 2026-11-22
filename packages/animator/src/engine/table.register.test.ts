import { describe, expect, it } from 'vitest';
import { AnimatorEventHub } from '../observe';
import { createTable } from './table';

describe('a registration whose interrupt throws', () => {
  it('stops the voice the new animation cued and throws to the caller', () => {
    const stopped: number[] = [];
    const table = createTable({
      codec: { stop(id) { stopped.push(id); }, has: () => false, rate() {} },
      hub: new AnimatorEventHub(),
      elapsed: () => 0,
      direction: () => 1,
      seedClock() {},
      showNow() {},
      resting: () => false,
      framing: () => false,
      requestFrame() {},
    });
    table.register({ id: 1, kind: 'tween', cancelKey: 'k', tick: () => false, onCancel: () => { throw new Error('bad cancel'); } });
    expect(() => table.register({ id: 2, kind: 'tween', cancelKey: 'k', tick: () => false })).toThrow('bad cancel');
    expect(stopped).toContain(2);
    expect(table.animations.has(2)).toBe(false);
  });
});
