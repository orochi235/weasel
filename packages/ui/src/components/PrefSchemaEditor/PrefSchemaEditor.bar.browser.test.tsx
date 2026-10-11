import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } } },
};

const midX = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.left + r.width / 2;
};

test('the palette sits at the middle of the bar, whatever the host sets at its start', () => {
  render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} bar={<span>A host control of some length</span>} />);
  const bar = screen.getByRole('group', { name: 'Schema tools' });
  const drag = within(bar).getByRole('group', { name: 'Drag to add' });
  const palette = drag.parentElement!;
  expect(Math.abs(midX(palette) - midX(bar))).toBeLessThan(1);
});

test('the add and remove tools sit in the palette, past a rule after the drag tools', () => {
  render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
  const drag = screen.getByRole('group', { name: 'Drag to add' });
  const palette = drag.parentElement!;
  const rule = within(palette).getByRole('separator');
  const acts = within(palette).getByRole('group', { name: 'Add or remove' });
  expect(within(acts).getAllByRole('button').map((b) => b.textContent)).toEqual(['Add pref', 'Add group', 'Add alias', 'Remove']);
  const ruleBox = rule.getBoundingClientRect();
  expect(ruleBox.height).toBeGreaterThan(20);
  expect(ruleBox.left).toBeGreaterThan(drag.getBoundingClientRect().right);
  expect(acts.getBoundingClientRect().left).toBeGreaterThan(ruleBox.right);
});
