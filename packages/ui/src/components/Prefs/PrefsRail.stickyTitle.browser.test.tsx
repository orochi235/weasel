import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PrefsForm } from './PrefsForm';

// Where a sticky heading rests, and where a scroll to a row under it ends, are the browser's to say.

beforeAll(() => page.viewport(900, 500));
afterEach(cleanup);

const flags = (prefix: string, n: number) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`f${i}`, { kind: 'boolean' as const, name: `${prefix} ${i}`, description: '', default: false }]),
  );
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: { tools: { name: 'Tools', children: { brush: { name: 'Brush', as: 'section', children: flags('Brush', 40) } } } },
};

const mount = () => {
  const { container } = render(
    <div style={{ width: 820, height: 300, display: 'flex' }}>
      <PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} />
    </div>,
  );
  const pane = container.querySelector<HTMLElement>('[data-pref-into]')!;
  const title = pane.querySelector<HTMLElement>('[data-pref-sticky]')!;
  return { pane, title };
};

it('rests a stuck section heading against the pane\'s top edge, with no strip above it for rows to show in', () => {
  const { pane, title } = mount();
  pane.scrollTop = 400;
  const edge = pane.getBoundingClientRect().top + pane.clientTop;
  expect(Math.abs(title.getBoundingClientRect().top - edge)).toBeLessThan(0.5);
});

it('stops a row scrolled to right under the stuck heading', () => {
  const { pane, title } = mount();
  const row = pane.querySelector('[data-pref-path="tools.brush.f20"]')!;
  row.scrollIntoView({ block: 'start', behavior: 'instant' });
  expect(pane.scrollTop).toBeGreaterThan(0);
  const gap = row.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
  expect(gap).toBeGreaterThanOrEqual(-0.5);
  expect(gap).toBeLessThan(1.5);
});

it('stops a row scrolled to right under a stuck heading that wraps to two lines', async () => {
  const long = { ...SCHEMA.children.tools, children: { brush: { name: 'Brush pressure, tilt, and the curves shaping both', as: 'section', children: flags('Brush', 40) } } } as PrefGroup;
  const { container } = render(
    <div style={{ width: 420, height: 300, display: 'flex' }}>
      <PrefsForm layout="rail" schema={{ ...SCHEMA, children: { tools: long } }} values={{}} onChange={() => {}} />
    </div>,
  );
  const pane = container.querySelector<HTMLElement>('[data-pref-into]')!;
  const title = pane.querySelector<HTMLElement>('[data-pref-sticky]')!;
  const row = pane.querySelector<HTMLElement>('[data-pref-path="tools.brush.f20"]')!;
  expect(title.getBoundingClientRect().height).toBeGreaterThan(parseFloat(getComputedStyle(title).lineHeight) * 2);
  await expect.poll(() => parseFloat(getComputedStyle(row).scrollMarginTop)).toBeCloseTo(title.getBoundingClientRect().height, 1);
  row.scrollIntoView({ block: 'start', behavior: 'instant' });
  const gap = row.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
  expect(gap).toBeGreaterThanOrEqual(-0.5);
  expect(gap).toBeLessThan(1.5);
});
