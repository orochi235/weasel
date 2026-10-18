import '@weasel-js/theme/tokens.css';
import '../../canvas-kit-demo.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ScoreDemo } from '../ScoreDemo';

// A real AudioContext and a real clock: the score books bars against the audio
// thread, which jsdom has neither of.

afterEach(cleanup);

const text = (id: string): string => screen.getByTestId(id).textContent ?? '';

test('a playing score shows the bar in force, and a new mood on the next bar line', async () => {
  render(<ScoreDemo />);
  await userEvent.click(screen.getByRole('button', { name: 'urgency' }));
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
  // 140 bpm: a bar is 1.7 s.
  await expect.poll(() => text('bar'), { timeout: 8000 }).toBe('bar 2, 2 into the cue');
  expect(text('cue')).toBe('urgency');

  // Clicked and read in one task, so no bar can be booked in between.
  act(() => screen.getByRole('button', { name: 'dread' }).click());
  expect(text('cue'), 'the bar in force is still the one playing').toBe('urgency');
  await expect.poll(() => text('cue'), { timeout: 8000 }).toBe('dread');
  expect(text('bar')).toMatch(/^bar \d+, 1 into the cue$/);

  await userEvent.click(screen.getByRole('button', { name: 'stop' }));
  expect(text('bar')).toBe('stopped');
});

test('the roll and the three axes fit side by side, in a window 800 px tall', async () => {
  await page.viewport(1100, 800);
  const { container } = render(<ScoreDemo />);
  const canvas = container.querySelector('canvas')!.getBoundingClientRect();
  const panel = container.querySelector('.ckd-panel')!.getBoundingClientRect();
  expect([canvas.width, canvas.height]).toEqual([560, 230]);
  expect(panel.left).toBeGreaterThanOrEqual(canvas.right);
  expect(container.firstElementChild!.getBoundingClientRect().height).toBeLessThan(640);
});
