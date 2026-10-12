import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PrefsForm } from './PrefsForm';

// Which section is in view is the browser's to say: jsdom lays nothing out and scrolls nothing.

beforeAll(() => page.viewport(900, 500));
afterEach(cleanup);

const flags = (prefix: string, n = 12) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`f${i}`, { kind: 'boolean' as const, name: `${prefix} ${i}`, description: '', default: false }]),
  );
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: { name: 'Canvas', children: {
      ...flags('Canvas'),
      grid: { name: 'Grid', children: { ...flags('Grid'), dots: { name: 'Dots', children: flags('Dot', 30) } } },
      guides: { name: 'Guides', as: 'page', children: flags('Guide', 4) },
      rulers: { name: 'Rulers', children: flags('Ruler', 30) },
    } },
    io: { name: 'Export', children: flags('Export', 4) },
  },
};

const mount = (foldable = false) => {
  const form = (selected?: readonly string[]) => (
    <div style={{ width: 820, height: 300, display: 'flex' }}>
      <PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} foldable={foldable} selected={selected} />
    </div>
  );
  const { container, rerender } = render(form());
  const select = (path: string): void => rerender(form([path]));
  const entry = (path: string) => container.querySelector<HTMLElement>(`[data-pref-rail="${path}"]`)!;
  const pane = () => container.querySelector<HTMLElement>('[data-pref-into]')!;
  const scrollTo = (path: string): void => {
    const section = pane().querySelector(`[data-pref-path="${path}"]`)!;
    pane().scrollTop += section.getBoundingClientRect().top - pane().getBoundingClientRect().top + 4;
  };
  const marks = () => Object.fromEntries(
    [...container.querySelectorAll('[data-rail-mark]')].map((el) => [el.getAttribute('data-pref-rail'), el.getAttribute('data-rail-mark')]),
  );
  return { container, entry, pane, scrollTo, marks, select };
};

it('marks the section in view current and its page open, and the page alone above its first section', async () => {
  const { entry, pane, scrollTo, marks } = mount();
  expect(marks()).toEqual({ canvas: 'current' });

  scrollTo('canvas.grid');
  await expect.poll(marks).toEqual({ canvas: 'open', 'canvas.grid': 'current' });
  expect(entry('canvas.grid').getAttribute('aria-current')).toBe('location');
  expect(entry('canvas').getAttribute('aria-current')).toBe('page');

  // A section inside a section has no entry, so the one that holds it keeps the mark.
  expect(entry('canvas.grid.dots')).toBeNull();
  scrollTo('canvas.grid.dots');
  await expect.poll(() => pane().querySelector('[data-pref-path="canvas.grid.dots"]')!.getBoundingClientRect().top - pane().getBoundingClientRect().top).toBeLessThan(8);
  expect(marks()).toEqual({ canvas: 'open', 'canvas.grid': 'current' });

  scrollTo('canvas.rulers');
  await expect.poll(marks).toEqual({ canvas: 'open', 'canvas.rulers': 'current' });

  pane().scrollTop = 0;
  await expect.poll(marks).toEqual({ canvas: 'current' });
});

it('draws the two marks apart from each other and from an entry with neither', async () => {
  const { entry, scrollTo, marks } = mount();
  scrollTo('canvas.rulers');
  await expect.poll(marks).toEqual({ canvas: 'open', 'canvas.rulers': 'current' });
  const look = (path: string): string => {
    const style = getComputedStyle(entry(path));
    return `${style.backgroundColor} ${style.boxShadow} ${style.color}`;
  };
  const looks = new Set([look('canvas'), look('canvas.rulers'), look('canvas.grid')]);
  expect(looks.size).toBe(3);
  expect(getComputedStyle(entry('canvas.rulers')).backgroundColor).not.toBe(getComputedStyle(entry('canvas')).backgroundColor);
});

it('leaves a nested page off the page that holds it and scrolls to a section that follows it', async () => {
  const { entry, pane, marks } = mount();
  expect(pane().querySelector('[data-pref-path="canvas.guides"]')).toBeNull();
  fireEvent.click(entry('canvas.rulers'));
  const section = pane().querySelector('[data-spy-section="canvas.rulers"]')!;
  await expect.poll(() => Math.abs(section.getBoundingClientRect().top - pane().getBoundingClientRect().top), { timeout: 3000 }).toBeLessThan(2);
  expect(marks()).toEqual({ canvas: 'open', 'canvas.rulers': 'current' });

  fireEvent.click(entry('canvas.guides'));
  expect(pane().getAttribute('data-pref-into')).toBe('canvas.guides');
  expect(pane().scrollTop).toBe(0);
  expect(marks()).toEqual({ 'canvas.guides': 'current' });
});

it('scrolls a selected section inside another into view below the sticky heading above, its section marked', async () => {
  const { pane, marks, select } = mount();
  // A smooth scroll passes every offset on its way, so the pane is read once the browser says it has ended.
  const ended = new Promise((done) => pane().addEventListener('scrollend', done, { once: true }));
  select('canvas.grid.dots');
  await ended;
  const dots = pane().querySelector('[data-pref-path="canvas.grid.dots"]')!;
  const title = pane().querySelector('[data-spy-section="canvas.grid"] > [data-pref-sticky]')!;
  expect(pane().scrollTop).toBeGreaterThan(0);
  expect(dots.getBoundingClientRect().top).toBeGreaterThanOrEqual(title.getBoundingClientRect().bottom - 1);
  expect(dots.getBoundingClientRect().top - title.getBoundingClientRect().bottom).toBeLessThan(16);
  await expect.poll(marks).toEqual({ canvas: 'open', 'canvas.grid': 'current' });
});
