import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Before anything is published from 2.0 on, the releases page has nothing to list.
vi.mock('virtual:changelogs', () => ({ default: [] }));
vi.mock('virtual:changelogs/older', async () => ({
  default: (await import('@shared/releases')).indexReleases([
    {
      version: '1.9.0',
      date: '2026-11-01T00:00:00Z',
      entries: [{ id: 'a', packages: ['core'], titleHtml: 'an old change', bodyHtml: '', tags: ['new'], rank: 0, pick: false }],
    },
  ]),
}));

const { Releases } = await import('../Releases');
const { OlderReleases } = await import('../OlderReleases');

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(cleanup);

describe('the releases page with nothing since 2.0', () => {
  it('says so, and still links to the older releases', () => {
    render(<Releases />);
    expect(screen.getByText('Nothing has been published since 2.0 yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Releases before 2.0 →' })).toHaveAttribute('href', '#__older_releases');
  });
});

describe('the older releases page', () => {
  it('lists the releases before 2.0, with the first one open, and links back', async () => {
    render(<OlderReleases />);
    expect(screen.getByRole('heading', { level: 2, name: 'Releases before 2.0' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: '1.9.0' }).closest('details')!.open).toBe(true);
    expect(await screen.findByText('an old change')).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Releases since 2.0' })).toHaveAttribute('href', '#__releases');
  });
});

describe('moving between the two release pages', () => {
  it('drops a ?v= the arriving page does not list, and keeps the filter', () => {
    window.history.replaceState(null, '', '/?pkg=core&v=2.1.0#__older_releases');
    render(<OlderReleases />);
    expect(window.location.search).toBe('?pkg=core');
  });

  it('leaves the arriving entry of the other page alone on Back', () => {
    window.history.replaceState(null, '', '/?pkg=core#__older_releases');
    render(<OlderReleases />);
    window.history.replaceState(null, '', '/?v=2.1.0&pkg=text-tools#__releases');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(window.location.search).toBe('?v=2.1.0&pkg=text-tools');
  });
});
