import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FrontPage } from '../FrontPage/FrontPage';
import { routeOf } from '../routes';

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
      './docs/ui/forge/',
      './draw/',
      './chart/',
      '#__releases',
    ]);
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
