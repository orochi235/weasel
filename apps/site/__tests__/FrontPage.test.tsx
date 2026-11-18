import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FrontPage } from '../FrontPage/FrontPage';
import { routeOf } from '../routes';
import { FORGE_LAB } from '@shared/labs';
import { SITE_PROXY } from '../../../scripts/vite-site-proxy';

afterEach(cleanup);

const themed = () => document.querySelector('[data-wzl-theme]')!;

describe('the front page', () => {
  it('links to each section', () => {
    render(<FrontPage />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '#__get_started',
      '#pkg',
      '#__demos',
      FORGE_LAB.href,
      './draw/',
      './chart/',
      '#__releases',
    ]);
  });

  // A same-origin path the site's dev server neither serves nor forwards falls back to the site's own page.
  it('links only to apps the dev server can reach', () => {
    render(<FrontPage />);
    const site = new URL('http://site/weasel/');
    for (const a of screen.getAllByRole('link')) {
      const url = new URL(a.getAttribute('href')!, site);
      if (url.origin !== site.origin || url.pathname === site.pathname) continue;
      expect(Object.keys(SITE_PROXY).some((path) => url.pathname.startsWith(`${path}/`)), url.pathname).toBe(true);
    }
  });

  it('wears the project colors in dark mode, with no control to change them', () => {
    render(<FrontPage />);
    expect(themed().getAttribute('data-wzl-theme')).toBe('weasel-project');
    expect(themed().getAttribute('data-wzl-mode')).toBe('dark');
    expect(screen.queryByRole('radio')).toBeNull();
  });
});

describe('routeOf', () => {
  const isDemo = (id: string) => id === 'rect';

  it('gives the front page for an empty hash and for one naming nothing', () => {
    expect(routeOf('', isDemo)).toBe('');
    expect(routeOf('#', isDemo)).toBe('');
    expect(routeOf('#no-such-demo', isDemo)).toBe('');
  });

  it('gives a demo or a built-in page its own id', () => {
    expect(routeOf('#rect', isDemo)).toBe('rect');
    expect(routeOf('#__get_started', isDemo)).toBe('__get_started');
    expect(routeOf('#__whats_new', isDemo)).toBe('__whats_new');
    expect(routeOf('#__releases', isDemo)).toBe('__releases');
  });
});
