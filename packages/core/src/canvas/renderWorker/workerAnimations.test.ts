import { describe, expect, it } from 'vitest';
import { createScene } from '../../core/scene/scene';
import type { Scene } from '../../core/scene/types';
import { createWorkerAnimations } from './workerAnimations';

const scene = createScene({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;

describe('the worker animator', () => {
  it('plays a program by key at the frame time, and follows a clock back', () => {
    const seen: number[] = [];
    let asked = 0;
    const anims = createWorkerAnimations({
      fade: ({ animator, params }) => animator.tween({
        from: 0, to: (params as { to: number }).to, ms: 100, easing: 'linear', onTick: (v) => seen.push(v),
      }),
    }, () => { asked++; });
    anims.at({ elapsed: 0, rate: 0 }, false);
    anims.run([{ op: 'play', id: 1, key: 'fade', params: { to: 10 } }], scene);
    anims.advance();
    anims.at({ elapsed: 50, rate: 0 }, false);
    anims.advance();
    expect(seen.at(-1)).toBeCloseTo(5);
    anims.at({ elapsed: 20, rate: 0 }, false);
    anims.advance();
    expect(seen.at(-1)).toBeCloseTo(2);
    // A frame asked for inside a follow comes with the clock's next move instead.
    expect(asked).toBe(1);
  });

  it('steers what a program started by its id, and refuses a key nothing registered', () => {
    const anims = createWorkerAnimations({
      fade: ({ animator }) => animator.tween({ from: 0, to: 1, ms: 100, onTick: () => {} }),
    }, () => {});
    anims.at({ time: 0 }, false);
    anims.run([{ op: 'play', id: 7, key: 'fade' }, { op: 'pause', id: 7 }], scene);
    expect(anims.animator.isActive()).toBe(true);
    anims.run([{ op: 'cancel', id: 7 }], scene);
    expect(anims.animator.isActive()).toBe(false);
    expect(() => anims.run([{ op: 'play', id: 8, key: 'nope' }], scene)).toThrow(/nope/);
  });
});
