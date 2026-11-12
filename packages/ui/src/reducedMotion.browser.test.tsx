import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { commands } from 'vitest/browser';
import { Radio, RadioGroup } from '@weasel-js/ui/components/RadioGroup';
import { Switch } from '@weasel-js/ui/components/Switch';

// A control that slides or grows a part as it changes state does it at once where the reader asked for less motion.

beforeAll(() => commands.reducedMotion('reduce'));
afterAll(() => commands.reducedMotion('no-preference'));
afterEach(cleanup);

const moves = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo).transitionDuration !== '0s';

test('the emulation is on', () => {
  expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
});

test("a switch's thumb jumps to its side", () => {
  render(<Switch>s</Switch>);
  const thumb = screen.getByRole('switch').closest('label')?.querySelector("[class*='thumb']");
  expect(thumb).toBeTruthy();
  expect(moves(thumb as Element)).toBe(false);
});

test("a radio's dot appears at full size", () => {
  render(<RadioGroup aria-label="g"><Radio value="a">a</Radio></RadioGroup>);
  const dot = screen.getByRole('radio').closest('label')?.querySelector("[class*='dot']");
  expect(dot).toBeTruthy();
  expect(moves(dot as Element, '::after')).toBe(false);
});
