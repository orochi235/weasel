import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Release } from '../../shared/releases';

// A history the size of the real one: dozens of releases, hundreds of
// entries, most with a body.
const RELEASES: Release[] = Array.from({ length: 40 }, (_, r) => ({
  version: `1.${39 - r}.0`,
  date: '2026-09-14T00:00:00Z',
  entries: Array.from({ length: 60 }, (_, e) => ({
    id: `${r}-${e}`,
    packages: ['core'],
    titleHtml: `change ${r}-${e}`,
    bodyHtml: `<p>account of ${r}-${e}</p>`,
    level: 'patch' as const,
  })),
}));

vi.mock('virtual:changelogs', () => ({ default: RELEASES }));

const { Releases } = await import('../Releases');

const entries = () => document.querySelectorAll('.ckd-release-entry');
const release = (version: string) =>
  screen.getByRole('heading', { level: 3, name: version }).closest('details')!;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('what the Releases view mounts', () => {
  it('mounts only the open release, not the whole history', () => {
    render(<Releases />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(40);
    expect(entries()).toHaveLength(60);
    expect(screen.queryByText('change 5-0')).toBeNull();
  });

  it("leaves an entry's folded body out until its title is opened", async () => {
    render(<Releases />);
    expect(screen.queryByText('account of 0-3')).toBeNull();
    await userEvent.click(screen.getByText('change 0-3'));
    expect(screen.getByText('account of 0-3')).toBeTruthy();
  });

  it('mounts a release when it is opened', async () => {
    render(<Releases />);
    await userEvent.click(screen.getByRole('heading', { level: 3, name: '1.30.0' }));
    expect(release('1.30.0').open).toBe(true);
    expect(screen.getByText('change 9-0')).toBeTruthy();
  });
});

describe('a link to one version', () => {
  it('opens that release and scrolls it into view', () => {
    const scrolled: Element[] = [];
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
      this: Element,
    ) {
      scrolled.push(this);
    });
    window.history.replaceState(null, '', '/?v=1.2.0#__releases');
    render(<Releases />);
    const target = release('1.2.0');
    expect(target.open).toBe(true);
    expect(screen.getByText('change 37-0')).toBeTruthy();
    expect(scrolled).toEqual([target]);
    spy.mockRestore();
  });

  it('keeps the version in the URL when the filter changes', async () => {
    window.history.replaceState(null, '', '/?v=1.2.0#__releases');
    render(<Releases />);
    await userEvent.click(screen.getAllByRole('button', { name: /^core/ })[0]);
    expect(new URLSearchParams(window.location.search).get('v')).toBe('1.2.0');
  });
});
