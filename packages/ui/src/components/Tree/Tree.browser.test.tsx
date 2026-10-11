import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useState } from 'react';
import { Tree, type TreeNode } from './Tree';
import { applyMove } from './Tree.fixtures';

afterEach(cleanup);

const START: TreeNode[] = [
  { id: 'g', label: 'Group', children: [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }] },
  { id: 'z', label: 'Zed' },
];

function Live() {
  const [nodes, setNodes] = useState(START);
  return <Tree aria-label="T" nodes={nodes} defaultExpandedIds={['g']} onMove={(ids, t) => setNodes((n) => applyMove(n, ids, t))} />;
}

const frame = () => new Promise((r) => requestAnimationFrame(r));

async function dragTo(from: HTMLElement, toX: number, toY: number) {
  const a = from.getBoundingClientRect();
  const x0 = a.left + 20;
  const y0 = a.top + a.height / 2;
  const opts = (x: number, y: number) => ({ bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y, isPrimary: true });
  from.dispatchEvent(new PointerEvent('pointerdown', opts(x0, y0)));
  for (let i = 1; i <= 8; i++) {
    document.dispatchEvent(new PointerEvent('pointermove', opts(x0 + ((toX - x0) * i) / 8, y0 + ((toY - y0) * i) / 8)));
    await frame();
  }
  document.dispatchEvent(new PointerEvent('pointerup', opts(toX, toY)));
  await frame();
}

const labels = () => screen.getAllByRole('treeitem').map((li) => li.querySelector('[id]')!.textContent);
const rowOf = (name: string) => screen.getByRole('treeitem', { name }).firstElementChild as HTMLElement;

test('dragging a top-level row onto the upper half of a child moves it into the group', async () => {
  render(<Live />);
  const ex = rowOf('Ex').getBoundingClientRect();
  await dragTo(rowOf('Zed'), ex.left + 30, ex.top + 3);
  expect(labels()).toEqual(['Group', 'Zed', 'Ex', 'Why']);
  expect(screen.getByRole('treeitem', { name: 'Zed' })).toHaveAttribute('aria-level', '2');
});

test('below the last child, a pointer at the top level drops after the group', async () => {
  render(<Live />);
  const group = rowOf('Group').getBoundingClientRect();
  const why = rowOf('Why').getBoundingClientRect();
  await dragTo(rowOf('Ex'), group.left + 2, why.bottom - 2);
  expect(screen.getByRole('treeitem', { name: 'Ex' })).toHaveAttribute('aria-level', '1');
});

test('folded by its leading glyphs, a branch and a leaf at one level start their labels at one x, each level a step further in', () => {
  const glyph = <span style={{ display: 'inline-block', width: 16, height: 16 }} />;
  const nodes: TreeNode[] = [
    { id: 'g', label: 'Group', leading: glyph, children: [
      { id: 'x', label: 'Ex' },
      { id: 'h', label: 'Inner', leading: glyph, children: [{ id: 'y', label: 'Why' }] },
    ] },
    { id: 'z', label: 'Zed' },
  ];
  render(<Tree aria-label="T" nodes={nodes} foldBy="leading" defaultExpandedIds={['g', 'h']} />);
  const left = (name: string) => screen.getByRole('treeitem', { name }).querySelector('[id]')!.getBoundingClientRect().left;
  expect(left('Group')).toBe(left('Zed'));
  expect(left('Ex')).toBe(left('Inner'));
  const step = left('Ex') - left('Group');
  expect(step).toBe(16);
  expect(left('Why') - left('Inner')).toBe(step);
});
