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
