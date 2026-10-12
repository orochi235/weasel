import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Tree, type TreeNode } from './Tree';

// What `document.activeElement` is after the focused element leaves the page is the browser's answer, not jsdom's.

afterEach(cleanup);

const leaf = (id: string): TreeNode => ({ id, label: id.toUpperCase() });
const START: TreeNode[] = [
  { id: 'g', label: 'Group', children: [leaf('x'), leaf('y'), leaf('w')] },
  { id: 'h', label: 'Solo', children: [leaf('only')] },
  leaf('z'),
];

const without = (nodes: readonly TreeNode[], id: string): TreeNode[] =>
  nodes.flatMap((n) => (n.id === id ? [] : [n.children ? { ...n, children: without(n.children, id) } : n]));

const view = (nodes: readonly TreeNode[], expanded: string[] = ['g', 'h']) => (
  <>
    <button type="button">outside</button>
    <Tree aria-label="T" nodes={nodes} expandedIds={expanded} />
  </>
);
const item = (name: string) => screen.getByRole('treeitem', { name });

test.each([
  ['a row with a sibling after it', 'x', 'Y'],
  ['the last row of a branch', 'w', 'Y'],
  ['the only row of a branch', 'only', 'Solo'],
  ['a branch with rows inside', 'g', 'Solo'],
])('removing %s while it holds focus moves focus to a row', (_what, id, lands) => {
  const { rerender } = render(view(START));
  item(id === 'g' ? 'Group' : id.toUpperCase()).focus();
  rerender(view(without(START, id)));
  expect(document.activeElement).toBe(item(lands));
});

test('removing a branch while a row inside it holds focus moves focus to the next row', () => {
  const { rerender } = render(view(START));
  item('Y').focus();
  rerender(view(without(START, 'g')));
  expect(document.activeElement).toBe(item('Solo'));
});

test('folding a branch away under the focused row moves focus to the branch', () => {
  const { rerender } = render(view(START));
  item('Y').focus();
  rerender(view(START, ['h']));
  expect(document.activeElement).toBe(item('Group'));
});

test('a row removed while focus is somewhere else leaves focus there', () => {
  const { rerender } = render(view(START));
  item('X').focus();
  const outside = screen.getByRole('button', { name: 'outside' });
  outside.focus();
  rerender(view(without(START, 'x')));
  expect(document.activeElement).toBe(outside);
});

test('another row removed leaves focus on the row that holds it', () => {
  const { rerender } = render(view(START));
  item('Y').focus();
  rerender(view(without(START, 'x')));
  expect(document.activeElement).toBe(item('Y'));
});
