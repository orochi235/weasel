import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render } from '@testing-library/react';
import { JobProgress } from '@weasel-js/labkit/primitives';
import { afterEach, expect, test } from 'vitest';
import type { JobHandle } from '../job/types';

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
  const fill = container.querySelector<HTMLElement>('.lk-job__fill');
  const [animation] = fill?.getAnimations() ?? [];
  if (!fill?.parentElement || !animation?.effect) throw new Error('the fill is not animating');
  const track = fill.parentElement.getBoundingClientRect();
  const period = Number(animation.effect.getComputedTiming().duration);
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

test('the count holds its width as it climbs, so the controls after it stay put', async () => {
  const at = (done: number) => ({ ...running, done, total: 120 });
  const { container, rerender } = render(<JobProgress job={at(9)} />);
  // The faces load on first use and swap in (`font-display: swap`); one landing mid-loop moved the
  // cancel button 0.5 px at 100 on a loaded node.
  const count = container.querySelector('.lk-job__count');
  if (!count) throw new Error('no count');
  // Not the `font` shorthand: with `font-variant-numeric` set, Chromium computes it as ''.
  const { fontSize, fontFamily } = getComputedStyle(count);
  await document.fonts.load(`${fontSize} ${fontFamily}`, '0123456789 /');
  await document.fonts.ready;
  const cancel = () => container.querySelector('.lk-job__cancel')?.getBoundingClientRect().left;
  const first = cancel();
  for (const done of [10, 99, 100, 120]) {
    rerender(<JobProgress job={at(done)} />);
    expect(cancel(), `at ${done}`).toBeCloseTo(first ?? Number.NaN, 1);
  }
});
