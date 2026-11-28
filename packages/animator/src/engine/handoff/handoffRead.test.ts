import { afterEach, describe, expect, it } from 'vitest';
import { linear } from '@weasel-js/geom';
import { createColorOverrideRegistry } from '../../colorRegistry';
import { createTrimOverrideRegistry } from '../../trimRegistry';
import { createAnimatorCore } from '../core';
import { element, type FakeAnimation } from './testing/fakeAnimate';

afterEach(() => { Reflect.deleteProperty(document, 'timeline'); });

describe('the clock read between frames while only handed-off runs play', () => {
  it('is not charged again by a frame stamped before the read', () => {
    const timeline = { now: 0, animations: [] as FakeAnimation[] };
    Object.defineProperty(document, 'timeline', { configurable: true, value: { get currentTime() { return timeline.now; } } });
    const core = createAnimatorCore({
      now: () => timeline.now,
      requestFrame() {},
      cancelFrame() {},
      tripwire: () => false,
      colorOverrides: createColorOverrideRegistry(),
      trimOverrides: createTrimOverrideRegistry(),
    });
    const e = element(timeline);
    core.tick(0);
    core.api.tween({ target: e.target, to: { x: 100 }, ms: 1000, easing: linear, compositor: 'require' });
    core.tick(100);
    // A start between frames reads the clock at 200; the frame after it was stamped at 150.
    timeline.now = 200;
    const seen: number[] = [];
    core.api.tween({ from: 0, to: 1000, ms: 1000, easing: linear, onTick: (v) => seen.push(v) });
    core.tick(150);
    timeline.now = 250;
    core.tick(250);
    expect(seen.at(-1)).toBeCloseTo(50, 6);
    expect(e.target.read().x).toBeCloseTo(25, 6);
  });
});
