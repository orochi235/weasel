import '@weasel-js/theme/tokens.css';
import '../../canvas-kit-demo.css';
import { cleanup, render, screen } from '@testing-library/react';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import { afterEach, expect, test } from 'vitest';
import { DebugOverlayDemo } from '../DebugOverlayDemo';

// Which overlay segments a drag crosses is a hit test against the laid-out toolbar.

afterEach(cleanup);

test('a drag across the overlay segments turns on each one it reaches', () => {
  render(<DebugOverlayDemo />);
  const segments = [...screen.getByRole('group', { name: 'Debug overlays' }).querySelectorAll('button')];
  const before = segments.map((b) => b.getAttribute('aria-pressed'));
  const from = before.indexOf('false');
  expect(from).toBeGreaterThanOrEqual(0);
  sweepAcross(segments.slice(from, from + 3));
  expect(segments.slice(from, from + 3).map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true']);
});
