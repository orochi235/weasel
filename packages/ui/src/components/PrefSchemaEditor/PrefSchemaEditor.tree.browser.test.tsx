import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: {
    grid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
    snap: { kind: 'boolean', name: 'Snap', description: '', default: false },
  } } },
};

const sizeOf = (el: Element) => parseFloat(getComputedStyle(el).fontSize);

// Badge sizes its own text, so only the cascade a browser resolves says which rule won.
test('a group\'s count is set 2px under its row\'s label, and a kind badge stays smaller than the label', () => {
  render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
  const tree = within(screen.getByRole('tree', { name: 'Schema structure' }));
  const label = sizeOf(tree.getByText('View'));
  expect(sizeOf(tree.getByText('2'))).toBe(label - 2);
  expect(sizeOf(tree.getAllByText('boolean')[0]!)).toBeLessThan(label);
});

test('a group\'s count is set in the row\'s own face, with digits of their own widths', () => {
  render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
  const tree = within(screen.getByRole('tree', { name: 'Schema structure' }));
  const count = getComputedStyle(tree.getByText('2'));
  expect(count.fontFamily).toBe(getComputedStyle(tree.getByText('View')).fontFamily);
  expect(count.fontFamily).not.toContain('Tabular');
  expect(count.fontVariantNumeric).toBe('normal');
});
