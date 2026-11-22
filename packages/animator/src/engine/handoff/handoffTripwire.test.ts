import { describe, expect, it, vi } from 'vitest';
import { createColorOverrideRegistry } from '../../colorRegistry';
import { createTrimOverrideRegistry } from '../../trimRegistry';
import { createAnimatorCore } from '../core';
import { element, FakeAnimation } from './testing/fakeAnimate';

describe('a handed-off run taken back to the main thread', () => {
  it('leaves the table once the host has unmounted', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let now = 0;
    let tripped = false;
    const timeline = { now: 0, animations: [] as FakeAnimation[] };
    const core = createAnimatorCore({
      now: () => now,
      requestFrame() {},
      cancelFrame() {},
      tripwire: () => tripped,
      colorOverrides: createColorOverrideRegistry(),
      trimOverrides: createTrimOverrideRegistry(),
    });
    const tick = (t: number): void => { now = t; timeline.now = t; core.tick(t); };
    const e = element(timeline);
    tick(0);
    core.api.tween({ target: e.target, to: { x: 100 }, ms: 200, compositor: 'require' });
    tick(16);
    // Another animation on its target takes the run back to the main thread.
    core.api.hold({ target: e.target, value: { x: 0 }, weight: 0 });
    expect(core.api.live().filter((a) => a.kind === 'tween')).toHaveLength(2);
    tripped = true;
    tick(32);
    tick(48);
    expect(core.api.live().filter((a) => a.kind === 'tween')).toHaveLength(0);
    errors.mockRestore();
  });
});
