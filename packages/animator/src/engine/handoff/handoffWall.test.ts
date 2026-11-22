import { afterEach, describe, expect, it } from 'vitest';
import { linear } from '@weasel-js/geom';
import { createColorOverrideRegistry } from '../../colorRegistry';
import { createTrimOverrideRegistry } from '../../trimRegistry';
import { createAnimatorCore } from '../core';
import { element, type FakeAnimation } from './testing/fakeAnimate';

afterEach(() => { Reflect.deleteProperty(document, 'timeline'); });

describe('a handed-off run on a host clock apart from the document timeline', () => {
  it('is placed on the document timeline', () => {
    const timeline = { now: 0, animations: [] as FakeAnimation[] };
    Object.defineProperty(document, 'timeline', { configurable: true, value: { get currentTime() { return timeline.now; } } });
    // The host's frames and `now` run 5 s ahead of the document timeline.
    const ahead = 5000;
    const core = createAnimatorCore({
      now: () => timeline.now + ahead,
      requestFrame() {},
      cancelFrame() {},
      tripwire: () => false,
      colorOverrides: createColorOverrideRegistry(),
      trimOverrides: createTrimOverrideRegistry(),
    });
    const step = (ms: number): void => {
      timeline.now += ms;
      for (const a of timeline.animations) a.advance();
      core.tick(timeline.now + ahead);
    };
    const e = element(timeline);
    step(0);
    core.api.tween({ target: e.target, to: { x: 100 }, ms: 1000, easing: linear, compositor: 'require' });
    step(16);
    step(484);
    expect(e.last().shownX()).toBeCloseTo(e.target.read().x, 3);
    expect(e.target.read().x).toBeCloseTo(50, 3);
  });
});
