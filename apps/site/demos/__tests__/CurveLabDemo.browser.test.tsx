import '@weasel-js/theme/tokens.css';
import '../../canvas-kit-demo.css';
import { cleanup, render, screen } from '@testing-library/react';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import { afterEach, expect, test } from 'vitest';
import { CurveLabDemo } from '../CurveLabDemo';
import { withIcons } from '../../testIcons';

// Which overlay checkboxes a drag crosses is a hit test against the laid-out toolbar.

afterEach(cleanup);

test('a drag across the overlay checkboxes sets each one it reaches to what the press set the first', () => {
  render(<CurveLabDemo />, { wrapper: withIcons });
  const boxes = within('Overlays');
  // From anchors, which starts on: every box the drag reaches goes off.
  sweepAcross(boxes);
  expect(boxes.map((b) => b.checked)).toEqual([false, false, false]);
});

function within(name: string): HTMLInputElement[] {
  return [...screen.getByRole('group', { name }).querySelectorAll('input')];
}
