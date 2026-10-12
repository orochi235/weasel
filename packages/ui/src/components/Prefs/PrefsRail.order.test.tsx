import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const text = (name: string) => ({ kind: 'string' as const, name, description: '', default: '' });
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    page: { name: 'Page', children: {
      light: { name: 'Light', as: 'tab', children: { ink: text('Ink') } },
      note: text('Note'),
      dark: { name: 'Dark', as: 'tab', children: { glow: text('Glow') } },
      edge: { name: 'Edge', as: 'section', children: { radius: text('Radius') } },
      last: text('Last'),
    } },
  },
};

/** The tabs, rows, and sections drawn, in document order, less what the open tabs hold. */
const order = (container: HTMLElement) =>
  [...container.querySelectorAll('[role="tab"], [data-pref-leaf], section')]
    .map((el) => el.getAttribute('data-pref-path') + (el.getAttribute('role') === 'tab' ? ':tab' : ''))
    .filter((p) => p !== 'page' && p !== 'page.light.ink' && p !== 'page.dark.glow');

for (const layout of ['rail', 'columns', 'list'] as const) {
  it(`draws a group's leaves and groups in schema order in the ${layout} layout`, () => {
    const { container } = render(<PrefsForm layout={layout} schema={SCHEMA} onChange={() => {}} />);
    expect(order(container)).toEqual(['page.light:tab', 'page.note', 'page.dark:tab', 'page.edge', 'page.edge.radius', 'page.last']);
    // A tab on either side of a row is a strip of its own.
    expect(screen.getAllByRole('tablist')).toHaveLength(2);
  });
}

it('wraps each run of rows on a rail page in a block of its own, so a group between two runs splits them', () => {
  const { container } = render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} />);
  const pane = container.querySelector('[data-pref-into="page"]')!;
  const blocks = [...pane.children].filter((el) => el.querySelector(':scope > [data-pref-leaf]'));
  expect(blocks.map((el) => [...el.children].map((row) => row.getAttribute('data-pref-path')))).toEqual([['page.note'], ['page.last']]);
});
