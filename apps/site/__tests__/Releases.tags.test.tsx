import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangelogEntry, Release, Tag } from '../../shared/releases';

const entry = (id: string, packages: string[], tags: Tag[]): ChangelogEntry => ({
  id, packages, titleHtml: id, bodyHtml: '', tags, rank: 0, pick: false,
});

// One release, so every entry is in the release that starts open.
const RELEASES: Release[] = [
  {
    version: 'Unreleased',
    entries: [
      entry('core new api', ['core'], ['new', 'api']),
      entry('core fix', ['core'], ['fix']),
      entry('geom fix', ['geom'], ['fix', 'visual']),
      entry('geom faster', ['geom'], ['perf']),
    ],
  },
];

vi.mock('virtual:changelogs', async () => ({
  default: (await import('../../shared/releases')).indexReleases(RELEASES),
}));

const { Releases } = await import('../Releases');

const kinds = () => screen.getByRole('group', { name: 'Filter by kind of change' });
const kind = (tag: string) => within(kinds()).getByRole('button', { name: new RegExp(`^${tag}`) });
const pkg = (name: string) =>
  within(screen.getByRole('group', { name: 'Filter by package' })).getByRole('button', { name: new RegExp(`^${name}`) });
const titles = async () => {
  await waitFor(() => expect(document.querySelector('.ckd-release-entry')).not.toBeNull());
  return [...document.querySelectorAll('.ckd-release-entry .ckd-release-title')].map((t) => t.textContent).sort();
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('the tag filter', () => {
  it('offers every tag that appears, in the tags\' own order, with its entry count', () => {
    render(<Releases />);
    expect(within(kinds()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'api1', 'new1', 'visual1', 'perf1', 'fix2',
    ]);
  });

  it('keeps only the entries carrying the chosen tag, with Fixes open rather than folded', async () => {
    render(<Releases />);
    await userEvent.click(kind('fix'));
    expect(await titles()).toEqual(['core fix', 'geom fix']);
    expect(screen.getByText('2 changes · tagged fix')).toBeTruthy();
  });

  it('unions two tags', async () => {
    render(<Releases />);
    await userEvent.click(kind('perf'));
    await userEvent.click(kind('api'));
    expect(await titles()).toEqual(['core new api', 'geom faster']);
  });

  it('intersects with the package filter', async () => {
    render(<Releases />);
    await userEvent.click(pkg('geom'));
    await userEvent.click(kind('fix'));
    expect(await titles()).toEqual(['geom fix']);
    expect(screen.getByText('1 change in geom · tagged fix')).toBeTruthy();
  });

  it('filters from an entry\'s own tag chip', async () => {
    render(<Releases />);
    const li = (await screen.findByText('geom faster')).closest('li')!;
    await userEvent.click(within(li).getByRole('button', { name: 'perf' }));
    expect(kind('perf')).toHaveAttribute('aria-pressed', 'true');
    expect(await titles()).toEqual(['geom faster']);
  });

  it('clears tags and packages together on All', async () => {
    render(<Releases />);
    await userEvent.click(pkg('core'));
    await userEvent.click(kind('fix'));
    await userEvent.click(pkg('All'));
    expect(window.location.search).toBe('');
  });
});

describe('the tag filter in the URL', () => {
  it('writes the chosen tags to a tag query param beside pkg', async () => {
    render(<Releases />);
    await userEvent.click(pkg('core'));
    await userEvent.click(kind('fix'));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('pkg')).toBe('core');
    expect(params.get('tag')).toBe('fix');
  });

  it('restores tags present at mount and ignores a name that is not a tag', async () => {
    window.history.replaceState(null, '', '/?tag=perf,nonesuch');
    render(<Releases />);
    expect(kind('perf')).toHaveAttribute('aria-pressed', 'true');
    expect(await titles()).toEqual(['geom faster']);
  });
});
