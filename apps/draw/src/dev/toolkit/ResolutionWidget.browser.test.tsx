import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import { afterEach, expect, test } from 'vitest';
import { ResolutionWidget } from './ResolutionWidget';

// Which modifier segments a drag crosses is a hit test against the laid-out bar.

afterEach(cleanup);

test('a drag across the modifier segments holds each one it reaches', () => {
  render(<ResolutionWidget tools={[]} actions={[]} activeToolId="select" />);
  const mods = ['shift', 'alt', 'meta'].map((name) => screen.getByRole('button', { name }));
  sweepAcross(mods);
  expect(['shift', 'alt', 'meta', 'ctrl'].map((name) => screen.getByRole('button', { name }).getAttribute('aria-pressed')))
    .toEqual(['true', 'true', 'true', 'false']);
});
