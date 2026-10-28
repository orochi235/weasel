import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PrefsForm } from './PrefsForm';

// Where a pane is scrolled to is the browser's to say: jsdom's elements neither scroll nor have `scrollTo`.

beforeAll(() => page.viewport(900, 500));
afterEach(cleanup);

const flags = (prefix: string) =>
  Object.fromEntries(
    Array.from({ length: 40 }, (_, i) => [`f${i}`, { kind: 'boolean' as const, name: `${prefix} ${i}`, description: '', default: false }]),
  );
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    a: { name: 'First', children: flags('One') },
    b: { name: 'Second', children: flags('Two') },
    c: { name: 'Third', children: { ...flags('Three'), deep: { name: 'Deep', children: flags('Four') } } },
  },
};

const form = (section: string) => (
  <div style={{ width: 820, height: 300, display: 'flex' }}>
    <PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} section={section} />
  </div>
);

it('opens a page its owner switched to at the top, not where the last page was scrolled to', () => {
  const { container, rerender } = render(form('a'));
  const pane = container.querySelector('[data-pref-into]')!;
  pane.scrollTop = 400;
  expect(pane.scrollTop).toBe(400);
  rerender(form('b'));
  const now = container.querySelector('[data-pref-into]')!;
  expect(now.getAttribute('data-pref-into')).toBe('b');
  expect(now.scrollTop).toBe(0);
});

// A scrollbar laid over a box takes no room, so only the padding keeps it off what the box holds.
it('keeps the rail\'s filter field and the pane\'s rows clear of the right edge a scrollbar lies along', () => {
  const { container } = render(
    <div style={{ width: 820, height: 300, display: 'flex' }}>
      <PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} filterable />
    </div>,
  );
  const clear = (box: Element, inner: Element) => box.getBoundingClientRect().left + box.clientWidth - inner.getBoundingClientRect().right;
  const rail = container.querySelector('nav')!;
  expect(clear(rail, rail.querySelector('input')!)).toBeGreaterThanOrEqual(16);
  const pane = container.querySelector('[data-pref-into]')!;
  expect(clear(pane, pane.querySelector('[data-pref-path]')!)).toBeGreaterThanOrEqual(16);
});

it('clears a scrollbar that takes room of its own once, by its gutter and not by the far side\'s padding too', async () => {
  const many: PrefGroup = { name: 'Preferences', children: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`s${i}`, { name: `Section ${i}`, children: flags(`Row ${i}`) }])) };
  const clear = (box: Element, inner: Element) => box.getBoundingClientRect().left + box.clientWidth - inner.getBoundingClientRect().right;
  // The setup lays every scrollbar over its box, and headless Chromium draws none, but a styled one's gutter takes
  // 15px on any machine, as a classic scrollbar does. It goes in before the form mounts: Chrome reserves nothing
  // for a box already laid out without it.
  const sheet = document.createElement('style');
  sheet.textContent = '.classic :is(nav, [data-pref-into]) { scrollbar-width: auto !important; scrollbar-gutter: stable; } .classic ::-webkit-scrollbar { width: 15px; }';
  document.head.append(sheet);
  try {
    const { container } = render(
      <div className="classic" style={{ width: 820, height: 300, display: 'flex' }}>
        <PrefsForm layout="rail" schema={many} values={{}} onChange={() => {}} />
      </div>,
    );
    const rail = container.querySelector('nav')!;
    const pane = container.querySelector<HTMLElement>('[data-pref-into]')!;
    await expect.poll(() => pane.hasAttribute('data-scrollbar') && rail.hasAttribute('data-scrollbar')).toBe(true);
    expect(pane.offsetWidth - pane.clientWidth).toBe(15);
    expect(clear(pane, pane.querySelector('[data-pref-path]')!)).toBeCloseTo(parseFloat(getComputedStyle(pane).paddingLeft), 0);
    expect(clear(rail, rail.querySelector('button')!)).toBeCloseTo(parseFloat(getComputedStyle(rail).paddingLeft), 0);
  } finally {
    sheet.remove();
  }
});

it('marks no scrollbar where it is laid over the box', () => {
  const { container } = render(form('a'));
  const pane = container.querySelector('[data-pref-into]')!;
  expect(pane.scrollHeight).toBeGreaterThan(pane.clientHeight);
  expect(pane.hasAttribute('data-scrollbar')).toBe(false);
  expect(container.querySelector('nav')!.hasAttribute('data-scrollbar')).toBe(false);
});
