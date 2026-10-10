import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FrontPage } from '../FrontPage/FrontPage';
import { routeOf } from '../routes';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const themed = () => document.querySelector('[data-wzl-theme]')!;

describe('the front page', () => {
  it('links to each section', () => {
    render(<FrontPage />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '#__get_started',
      './api/',
      '#__demos',
      './docs/ui/forge/',
      './draw/',
      '#__releases',
    ]);
  });

  it('switches palette from the toggle and remembers the choice', () => {
    const first = render(<FrontPage />);
    expect(themed().getAttribute('data-wzl-mode')).toBe('dark');

    fireEvent.click(screen.getByRole('radio', { name: 'Paper' }));
    expect(themed().getAttribute('data-wzl-mode')).toBe('light');

    first.unmount();
    render(<FrontPage />);
    expect(themed().getAttribute('data-wzl-mode')).toBe('light');
  });

  it('wears a different theme for the project palette', () => {
    render(<FrontPage />);
    const before = themed().getAttribute('data-wzl-theme');
    fireEvent.click(screen.getByRole('radio', { name: 'Project' }));
    expect(themed().getAttribute('data-wzl-theme')).not.toBe(before);
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
