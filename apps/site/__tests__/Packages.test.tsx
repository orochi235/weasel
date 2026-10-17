import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMOS } from '../registry';
import { App } from '../App';
import { WeaselDemos } from '../WeaselDemos';
import { PACKAGES, PACKAGES_BY_NAME, demosOf } from '../Packages/catalog';
// Loaded at collection so `lazy()` resolves from the module cache inside a test's timeout.
import '../Packages/Packages';
import '../Shell';
import { renderWithIcons } from '../testIcons';

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    },
  );
});

const go = (hash: string) => window.history.replaceState(null, '', `/${hash}`);
const main = () => within(screen.getByRole('main'));
const heading = async (level: number, name: string | RegExp) =>
  waitFor(() => expect(main().getByRole('heading', { level, name })).toBeTruthy(), { timeout: 5000 });

beforeEach(() => go(''));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the package pages', () => {
  it('lists every published package at #pkg, each linked to its page', async () => {
    go('#pkg');
    renderWithIcons(<WeaselDemos />);
    await heading(2, 'Packages');
    expect(main().getAllByRole('listitem')).toHaveLength(PACKAGES.length);
    expect(main().getByRole('link', { name: '@weasel-js/geom' }).getAttribute('href')).toBe('#pkg/geom');
  });

  it('opens a package on its overview: its entries from the manifest, then its README', async () => {
    go('#pkg/geom');
    renderWithIcons(<WeaselDemos />);
    await heading(2, '@weasel-js/geom');
    expect(main().getByRole('link', { name: '@weasel-js/geom/booleans' }).getAttribute('href')).toBe(
      '#pkg/geom/reference/booleans',
    );
    await heading(3, 'Install');
    expect(main().getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');
  });

  it('opens a guide by its slug, titled from the file\'s heading', async () => {
    go('#pkg/geom/guides/paths');
    renderWithIcons(<WeaselDemos />);
    await heading(3, 'Working with paths');
    expect(main().getByRole('link', { name: 'Guides' }).getAttribute('aria-current')).toBe('page');
  });

  it('lists the demos that import a package, each a link to the demo', async () => {
    const filed = DEMOS.find((demo) => demo.package === 'geom')!;
    go('#pkg/geom/demos');
    renderWithIcons(<WeaselDemos />);
    await heading(2, '@weasel-js/geom');
    expect(main().getByRole('link', { name: filed.title }).getAttribute('href')).toBe(`#${filed.id}`);
  });

  it('leaves a tab off a package that has nothing for it', async () => {
    const bare = PACKAGES.find((pkg) => pkg.guides.length === 0)!;
    go(`#pkg/${bare.name}`);
    renderWithIcons(<WeaselDemos />);
    await heading(2, bare.specifier);
    expect(main().queryByRole('link', { name: 'Guides' })).toBeNull();
    expect(main().getByRole('link', { name: 'Reference' })).toBeTruthy();
  });

  it('says the reference is not built when the site has none to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not built', { status: 404 })));
    go('#pkg/gestures/reference');
    renderWithIcons(<WeaselDemos />);
    await waitFor(() => expect(main().getByRole('status').textContent).toMatch(/has not been built/), { timeout: 5000 });
  });

  it('shows the front page for a package that does not exist', async () => {
    go('#pkg/no-such-package');
    renderWithIcons(<App />);
    expect(await screen.findByRole('link', { name: /get started/i })).toBeTruthy();
    expect(window.location.hash).toBe('');
  });
});

describe('the sidebar', () => {
  it('links a package heading to that package\'s page', () => {
    go(`#${DEMOS[0].id}`);
    renderWithIcons(<WeaselDemos />);
    const heading = within(screen.getByRole('complementary')).getByRole('heading', { level: 3, name: 'geom' });
    expect(within(heading).getByRole('link').getAttribute('href')).toBe('#pkg/geom');
  });
});

// Which demos a package page lists is derived from imports. The registry files a demo under at most
// one package by hand, and that filing must agree with the derivation, not stand beside it.
describe('the demos derived for a package', () => {
  it('include every demo the registry files under it', () => {
    const missing = DEMOS.filter((demo) => {
      if (!demo.package) return false;
      const pkg = PACKAGES_BY_NAME.get(demo.package);
      return !pkg || !demosOf(pkg).includes(demo);
    });
    expect(missing.map((demo) => `${demo.id} (${demo.package})`)).toEqual([]);
  });

  it('lead with the ones filed under it', () => {
    const geom = demosOf(PACKAGES_BY_NAME.get('geom')!);
    const firstOther = geom.findIndex((demo) => demo.package !== 'geom');
    const filed = geom.filter((demo) => demo.package === 'geom');
    expect(filed.length).toBeGreaterThan(0);
    expect(firstOther === -1 ? geom.length : firstOther).toBe(filed.length);
  });
});
