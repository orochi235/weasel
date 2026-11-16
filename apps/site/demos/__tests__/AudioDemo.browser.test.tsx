import '@weasel-js/theme/tokens.css';
import '../../canvas-kit-demo.css';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { AudioDemo } from '../AudioDemo';

// The inserts come up once the demo has built its engine on a real AudioContext, which jsdom has none of; which
// boxes a drag crosses is a hit test against the laid-out panel.

beforeEach(async () => { await page.viewport(1280, 900); });
afterEach(cleanup);

test('the music inserts solo on Alt-click, un-solo on a second, and sweep', async () => {
  render(<AudioDemo />);
  const group = screen.getByRole('group', { name: 'Music inserts' });
  const boxes = [...group.querySelectorAll('input')];
  await expect.poll(() => boxes.every((b) => !b.disabled)).toBe(true);
  const on = () => boxes.map((b) => b.checked);
  group.scrollIntoView({ block: 'center' });

  sweepAcross(boxes);
  expect(on()).toEqual([true, true, true]);
  // Past the click a sweep's release makes, which the group does not take for a flip.
  await new Promise((r) => setTimeout(r, 0));
  fireEvent.click(boxes[1]!, { altKey: true });
  expect(on()).toEqual([false, true, false]);
  fireEvent.click(boxes[1]!, { altKey: true });
  expect(on()).toEqual([true, true, true]);
});
