import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Release } from '../../shared/releases';

const MANY = ['bidi', 'core', 'geom', 'svg', 'text', 'ui'];
const RELEASES: Release[] = [
  { version: 'Unreleased', entries: [{ id: 'a', packages: MANY, titleHtml: 'touches six', bodyHtml: '', level: 'patch' }] },
];

vi.mock('virtual:changelogs', () => ({ default: RELEASES }));

const { Releases } = await import('../Releases');

afterEach(cleanup);

it('names every package an entry touches, however many', () => {
  render(<Releases />);
  const entry = screen.getByRole('listitem');
  expect(within(entry).getAllByRole('button').map((b) => b.textContent)).toEqual(MANY);
  expect(entry.textContent).not.toMatch(/\+\d/);
});
