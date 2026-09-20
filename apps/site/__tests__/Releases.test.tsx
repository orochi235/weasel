import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Release } from '../../shared/releases';

// The real module is built from every package's CHANGELOG, so its contents
// change with each release. These fixtures pin the behavior instead.
const RELEASES: Release[] = [
  {
    version: 'Unreleased',
    entries: [
      { id: 'a', packages: ['core', 'text'], titleHtml: 'px sizes', bodyHtml: '', level: 'patch' },
      { id: 'b', packages: ['bidi'], titleHtml: 'bidi only', bodyHtml: '', level: 'patch' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-09-14T00:00:00Z',
    entries: [
      { id: 'c', packages: ['core'], titleHtml: 'core only', bodyHtml: '', level: 'patch' },
      { id: 'd', packages: ['svg', 'ui'], titleHtml: 'svg and ui', bodyHtml: '', level: 'patch' },
    ],
  },
];

vi.mock('virtual:changelogs', () => ({ default: RELEASES }));

const { Releases } = await import('../Releases');

const chips = () => screen.getByRole('group', { name: 'Filter by package' });
const chip = (name: string) => within(chips()).getByRole('button', { name: new RegExp(`^${name}`) });
// The entry's own prose, not the listitem, whose textContent also runs the
// package chips together.
const titles = () =>
  screen.getAllByRole('listitem').map((li) => li.querySelector('.ckd-release-title')?.textContent);
const versions = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('the package filter', () => {
  it('offers every package that appears anywhere, with its entry count', () => {
    render(<Releases />);
    // Sorted, and `core` is named by two entries across two releases.
    expect(within(chips()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All',
      'bidi1',
      'core2',
      'svg1',
      'text1',
      'ui1',
    ]);
  });

  it('starts unfiltered, with All pressed', () => {
    render(<Releases />);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(titles()).toHaveLength(4);
  });

  it('keeps only the entries naming the chosen package', async () => {
    render(<Releases />);
    await userEvent.click(chip('text'));
    expect(titles()).toEqual(['px sizes']);
  });

  it('drops a release with nothing left in it', async () => {
    render(<Releases />);
    // `text` appears only in Unreleased, so 1.5.0 should not render at all.
    expect(versions()).toEqual(['Unreleased', '1.5.0']);
    await userEvent.click(chip('text'));
    expect(versions()).toEqual(['Unreleased']);
  });

  it('unions two packages rather than intersecting them', async () => {
    render(<Releases />);
    await userEvent.click(chip('text'));
    await userEvent.click(chip('bidi'));
    // Intersecting would leave nothing: no entry names both.
    expect(titles()).toHaveLength(2);
    expect(screen.getByText('2 changes in bidi, text')).toBeTruthy();
  });

  it('toggles a chip back off', async () => {
    render(<Releases />);
    await userEvent.click(chip('text'));
    await userEvent.click(chip('text'));
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(titles()).toHaveLength(4);
  });

  it('clears everything when All is chosen', async () => {
    render(<Releases />);
    await userEvent.click(chip('text'));
    await userEvent.click(chip('bidi'));
    await userEvent.click(chip('All'));
    expect(titles()).toHaveLength(4);
    expect(window.location.search).toBe('');
  });

  it('filters from an entry chip too, so a change pivots to its package', async () => {
    render(<Releases />);
    const entry = screen.getAllByRole('listitem')[0];
    await userEvent.click(within(entry).getByRole('button', { name: 'text' }));
    expect(titles()).toEqual(['px sizes']);
  });
});

describe('the filter in the URL', () => {
  it('writes the selection to a pkg query param', async () => {
    render(<Releases />);
    await userEvent.click(chip('text'));
    expect(new URLSearchParams(window.location.search).get('pkg')).toBe('text');
  });

  it('leaves the hash alone, because the hash is the app router', async () => {
    window.history.replaceState(null, '', '/#__releases');
    render(<Releases />);
    await userEvent.click(chip('core'));
    expect(window.location.hash).toBe('#__releases');
  });

  it('restores a selection present at mount', () => {
    window.history.replaceState(null, '', '/?pkg=bidi,text');
    render(<Releases />);
    expect(chip('bidi')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('text')).toHaveAttribute('aria-pressed', 'true');
    expect(titles()).toHaveLength(2);
  });

  it('ignores a package name that no entry carries', () => {
    window.history.replaceState(null, '', '/?pkg=nonesuch');
    render(<Releases />);
    expect(screen.getByText('No changes name those packages.')).toBeTruthy();
  });
});
