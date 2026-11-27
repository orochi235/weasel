import { act, cleanup, render } from '@testing-library/react';
import { bytes, duration, relative } from '@weasel-js/quantity';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveQuantity } from './LiveQuantity';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const seconds = 1 / 1000;
/** The drawn figures, without the copy a screen reader gets. */
const text = (c: HTMLElement) => c.querySelector('data')?.textContent;
/** Moves time on in steps, each committed, as frames would: one long jump would fire only the first wake. */
const advance = (ms: number) => {
  for (let left = ms; left > 0; left -= 100) act(() => { vi.advanceTimersByTime(Math.min(100, left)); });
};

it('counts on between readings, redrawing only when its text changes', () => {
  const at = performance.now();
  const { container } = render(<LiveQuantity reading={{ value: 12.2, at, rate: seconds }} display={duration()} locale="en-US" />);
  expect(text(container)).toBe('0:12');
  // One timer waits for the change at 12.5 s: nothing runs per frame.
  expect(vi.getTimerCount()).toBe(1);
  advance(290);
  expect(text(container)).toBe('0:12');
  advance(30);
  expect(text(container)).toBe('0:13');
  advance(1000);
  expect(text(container)).toBe('0:14');
});

it('sleeps for good when paused', () => {
  const { container } = render(<LiveQuantity reading={{ value: 75, at: performance.now(), rate: 0 }} display={duration()} locale="en-US" />);
  expect(text(container)).toBe('1:15');
  expect(vi.getTimerCount()).toBe(0);
});

it('counts down, and counts bytes', () => {
  const at = performance.now();
  const { container, rerender } = render(<LiveQuantity reading={{ value: 10, at, rate: -seconds }} display={duration()} locale="en-US" />);
  advance(600);
  expect(text(container)).toBe('0:09');
  // 100 bytes a millisecond: 1.2 MB turns 1.3 MB at 1.25 MB, half a second on.
  rerender(<LiveQuantity reading={{ value: 1_200_000, at: performance.now(), rate: 100 }} display={bytes()} locale="en-US" />);
  expect(text(container)).toBe('1.2 MB');
  advance(450);
  expect(text(container)).toBe('1.2 MB');
  advance(100);
  expect(text(container)).toBe('1.3 MB');
});

it('holds rather than counting back when a reading lands behind', () => {
  const t0 = performance.now();
  const { container, rerender } = render(<LiveQuantity reading={{ value: 10, at: t0, rate: seconds }} display={duration()} locale="en-US" />);
  advance(20_000);
  expect(text(container)).toBe('0:30');
  // The server says 29.4 s: the readout stays on 0:30 until 29.4 runs on to 30.5.
  rerender(<LiveQuantity reading={{ value: 29.4, at: performance.now(), rate: seconds }} display={duration()} locale="en-US" />);
  expect(text(container)).toBe('0:30');
  advance(1050);
  expect(text(container)).toBe('0:30');
  advance(100);
  expect(text(container)).toBe('0:31');
});

it('reads how long ago, moving a minute at a time', () => {
  // Something that happened 200 s ago: its offset from now falls a second a second.
  const { container } = render(<LiveQuantity reading={{ value: -200, at: performance.now(), rate: -seconds }} display={relative()} locale="en-US" />);
  expect(text(container)).toBe('3 min. ago');
  expect(vi.getTimerCount()).toBe(1);
  advance(39_000);
  expect(text(container)).toBe('3 min. ago');
  advance(2_000);
  expect(text(container)).toBe('4 min. ago');
});

it('draws nothing new while the page is hidden, and catches up when it shows', () => {
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  const { container } = render(<LiveQuantity reading={{ value: 0, at: performance.now(), rate: seconds }} display={duration()} locale="en-US" />);
  advance(5_000);
  expect(text(container)).toBe('0:00');
  hidden.mockReturnValue(false);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  advance(20);
  expect(text(container)).toBe('0:05');
});
