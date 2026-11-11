import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Release } from '../../shared/releases';

const MANY = ['bidi', 'core', 'geom', 'svg', 'text', 'ui'];
const RELEASES: Release[] = [
  { version: 'Unreleased', entries: [{ id: 'a', packages: MANY, titleHtml: 'touches six', bodyHtml: '', tags: ['new'], rank: 0, pick: false }] },
];

vi.mock('virtual:changelogs', async () => ({
  default: (await import('../../shared/releases')).indexReleases(RELEASES),
}));

const { Releases } = await import('../Releases');

afterEach(cleanup);

it('names every package an entry touches, however many', async () => {
  render(<Releases />);
  const entry = (await screen.findByText('touches six')).closest('li')!;
  expect(within(entry).getAllByRole('button').map((b) => b.textContent)).toEqual(MANY);
  expect(entry.textContent).not.toMatch(/\+\d/);
});
