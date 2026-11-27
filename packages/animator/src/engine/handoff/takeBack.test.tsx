import { describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { element, setup } from './testing/fakeAnimate';

type Animator = ReturnType<typeof setup>['animator'];
type Target = ReturnType<typeof element>['target'];

const tween = (a: Animator, target: Target, to: number, extra = {}) =>
  a.tween({ target, to: { x: to }, ms: 1000, easing: linear, compositor: 'auto', ...extra });

describe('a run handed to the compositor', () => {
  it('is not taken back by another animator, which is refused first', () => {
    const one = setup();
    const two = setup();
    const e = element(one.timeline);
    act(() => { tween(one.animator, e.target, 100); });
    one.step(0);
    one.step(500);
    expect(() => two.animator.tween({ target: e.target, to: { x: 0 }, ms: 100 })).toThrow(/another animator/);
    expect(() => two.animator.hold({ target: e.target, value: { x: 0 } })).toThrow(/another animator/);
    expect(e.last().canceled).toBe(false);
    expect(one.animator.live()[0]).toMatchObject({ compositor: true });
  });
});
