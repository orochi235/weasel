import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ChangelogEntry, Release, Tag } from '../../shared/releases';

const entry = (id: string, tags: Tag[]): ChangelogEntry => ({
  id, packages: ['core'], titleHtml: id, bodyHtml: '', tags, rank: 0, pick: false,
});

const RELEASES: Release[] = [
  {
    version: 'Unreleased',
    entries: [entry('a', ['new', 'api']), entry('b', ['fix']), entry('c', ['fix'])],
  },
];

vi.mock('virtual:changelogs', async () => ({
  default: (await import('../../shared/releases')).indexReleases(RELEASES),
}));

const { Releases } = await import('../Releases');

afterEach(cleanup);

it('shows a release total above its per-group breakdown', () => {
  render(<Releases />);
  expect(screen.getByText('3 changes')).toBeTruthy();
  expect(screen.getByText('1 new · 2 fixes')).toBeTruthy();
});
