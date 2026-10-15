import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Tree, type TreeNode } from './Tree';

afterEach(cleanup);

const GLYPH = <svg data-testid="glyph" width={20} height={20} viewBox="0 0 20 20" />;

const NODES: TreeNode[] = [
  { id: 'g', label: 'Group', children: [{ id: 'x', label: 'Ex', leading: GLYPH }, { id: 'y', label: 'Why' }] },
  { id: 'z', label: 'Zed', leading: GLYPH },
  { id: 'w', label: 'Double-u' },
];

const labelLeft = (name: string) =>
  screen.getByRole('treeitem', { name }).querySelector('[id]')!.getBoundingClientRect().left;

test('a hung glyph leaves its leaf label where a leaf without one starts', () => {
  render(<Tree aria-label="T" hang nodes={NODES} defaultExpandedIds={['g']} />);
  expect(labelLeft('Ex')).toBe(labelLeft('Why'));
  expect(labelLeft('Zed')).toBe(labelLeft('Double-u'));
});

test('a hung glyph stands whole in the gutter, left of its label', () => {
  render(<Tree aria-label="T" hang nodes={NODES} defaultExpandedIds={['g']} />);
  for (const name of ['Ex', 'Zed']) {
    const item = screen.getByRole('treeitem', { name });
    const row = item.firstElementChild!.getBoundingClientRect();
    const glyph = item.querySelector('[data-testid="glyph"]')!.getBoundingClientRect();
    expect(glyph.width).toBe(16);
    expect(glyph.left).toBeGreaterThanOrEqual(row.left);
    expect(glyph.right).toBeLessThan(labelLeft(name));
  }
});

test('without hang a glyph pushes its label along', () => {
  render(<Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} />);
  expect(labelLeft('Ex')).toBeGreaterThan(labelLeft('Why'));
});
