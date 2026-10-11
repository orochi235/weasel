import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from '../Bar';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const separator = { kind: 'separator', name: '', description: '', default: undefined } as PrefLeaf;
const children = { snap: flag('Snap'), rule: separator, grid: flag('Grid') };

it('draws a separator leaf as a rule between the rows around it, selectable where it was put', () => {
  const schema: PrefGroup = { name: 'View', children };
  const { container } = render(<PrefsForm layout="list" schema={schema} values={{}} onChange={() => {}} selected={[]} onSelect={() => {}} />);
  const rule = screen.getByRole('separator');
  expect(rule.tagName).toBe('HR');
  expect(rule.closest('[data-pref-path]')).toHaveAttribute('data-pref-path', 'rule');
  const paths = [...container.querySelectorAll('[data-pref-path]')].map((el) => el.getAttribute('data-pref-path'));
  expect(paths).toEqual(['snap', 'rule', 'grid']);
});

it('draws a separator leaf in a bar as an upright rule in a cell of its own, even at the bar\'s end', () => {
  const bar: PrefGroup = { name: 'View', as: 'bar', children: { snap: flag('Snap'), rule: separator } };
  render(<Bar schema={bar} values={{}} onChange={() => {}} />);
  expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
});
