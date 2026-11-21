import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Release } from '@shared/releases';

const RELEASES: Release[] = [
  {
    version: '2.0.0',
    date: '2026-11-21T00:00:00Z',
    entries: Array.from({ length: 150 }, (_, e) => ({
      id: `big-${e}`,
      packages: ['core'],
      titleHtml: `big change ${e}`,
      bodyHtml: '',
      tags: ['new' as const],
      rank: 0,
      pick: e === 0,
    })),
  },
];

vi.mock('virtual:changelogs', async () => ({
  default: (await import('@shared/releases')).indexReleases(RELEASES),
}));

const load = vi.fn();
const { default: INDEX } = await import('virtual:changelogs');
const real = INDEX[0]!.load;
INDEX[0]!.load = () => {
  load();
  return real();
};

const { Releases } = await import('../Releases');

const entries = () => document.querySelectorAll('.ckd-release-entry');

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('a large release that opens itself', () => {
  it('shows its highlights and counts, and fetches its entries only once asked', async () => {
    render(<Releases />);
    expect(screen.getByText('Highlights')).toBeTruthy();
    expect(entries()).toHaveLength(0);
    expect(load).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Show all 150 changes' }));
    expect(await screen.findByText('big change 149', { selector: '.ckd-release-entry .ckd-release-title' })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
