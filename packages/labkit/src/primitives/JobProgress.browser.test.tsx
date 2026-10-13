import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { JobHandle } from '../job/types';
import { JobProgress } from './JobProgress';

afterEach(cleanup);

const running: JobHandle = {
  status: 'running',
  done: 34,
  total: null,
  failures: [],
  error: null,
  start: () => {},
  cancel: () => {},
};

/** The fill's edges at each step of one sweep, as fractions of the track. */
function sweep(steps: number): { left: number; right: number }[] {
  const { container } = render(<JobProgress job={running} />);
  const fill = container.querySelector<HTMLElement>('.lk-job__fill')!;
  const track = fill.parentElement!.getBoundingClientRect();
  const [animation] = fill.getAnimations();
  const period = Number(animation.effect!.getComputedTiming().duration);
  animation.pause();
  return Array.from({ length: steps + 1 }, (_, i) => {
    // The last sample stops just short of the period, where the loop wraps.
    animation.currentTime = Math.min((i / steps) * period, period - 0.01);
    const box = fill.getBoundingClientRect();
    return {
      left: (box.left - track.left) / track.width,
      right: (box.right - track.left) / track.width,
    };
  });
}

test('the indeterminate sweep is off the track where its loop wraps', () => {
  const frames = sweep(20);
  expect(frames[0].right).toBeLessThanOrEqual(0.001);
  expect(frames[frames.length - 1].left).toBeGreaterThanOrEqual(0.999);
});

test('the indeterminate sweep never stalls or backs up while it is on the track', () => {
  const frames = sweep(20);
  for (let i = 1; i < frames.length; i++) {
    const onTrack = frames[i].right > 0 && frames[i - 1].left < 1;
    if (!onTrack) continue;
    expect(frames[i].left - frames[i - 1].left, `step ${i}`).toBeGreaterThan(0.005);
  }
});
