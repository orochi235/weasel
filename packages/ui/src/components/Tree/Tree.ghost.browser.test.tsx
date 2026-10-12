import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Tree, type TreeNode } from './Tree';

// Whether the ghost of a drag covers the row it is held over is a matter of two boxes, which only a browser lays out.

afterEach(cleanup);

const NODES: TreeNode[] = [
  { id: 'g', label: 'Group', children: [{ id: 'x', label: 'Ex' }] },
  { id: 'h', label: 'Another group', children: [{ id: 'y', label: 'Why' }] },
  { id: 'z', label: 'Zed' },
];

const rowOf = (name: string) => screen.getByRole('treeitem', { name }).firstElementChild as HTMLElement;
const ghost = () => document.querySelector<HTMLElement>('[aria-hidden="true"][class*="ghost"]')!;
const event = (type: string, x: number, y: number) =>
  new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, isPrimary: true });

/** Press `from` and carry it to a point `tx` across and `ty` down `onto`, holding there. */
function hold(from: HTMLElement, onto: HTMLElement, tx: number, ty: number): { x: number; y: number } {
  const a = from.getBoundingClientRect();
  const b = onto.getBoundingClientRect();
  const start = { x: a.left + 30, y: a.top + a.height / 2 };
  const end = { x: b.left + b.width * tx, y: b.top + b.height * ty };
  act(() => { from.dispatchEvent(event('pointerdown', start.x, start.y)); });
  for (let i = 1; i <= 8; i++) {
    act(() => { document.dispatchEvent(event('pointermove', start.x + ((end.x - start.x) * i) / 8, start.y + ((end.y - start.y) * i) / 8)); });
  }
  return end;
}

test.each([
  ['its middle', 0.3, 0.5],
  ['its top edge', 0.3, 0.05],
  ['its bottom edge', 0.3, 0.95],
])('a row held over a branch at %s leaves the branch\'s row uncovered, and sits just off the pointer', (_where, tx, ty) => {
  render(<div style={{ width: 320 }}><Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g', 'h']} onMove={() => {}} /></div>);
  const target = rowOf('Another group');
  const at = hold(rowOf('Zed'), target, tx, ty);
  const over = target.getBoundingClientRect();
  const drawn = ghost().getBoundingClientRect();
  const overlap = Math.min(drawn.bottom, over.bottom) - Math.max(drawn.top, over.top);
  expect(overlap).toBeLessThanOrEqual(0);
  // Still beside the pointer: below it by no more than two rows, and starting to its right.
  expect(drawn.top - at.y).toBeLessThanOrEqual(over.height * 2);
  expect(drawn.left).toBeGreaterThan(at.x);
  act(() => { document.dispatchEvent(event('pointerup', at.x, at.y)); });
});

test('the ghost keeps the space between the parts of a row\'s label', () => {
  const nodes: TreeNode[] = [{ id: 'a', label: <>Snap <i>(snap)</i></> }, { id: 'b', label: 'Bee' }];
  render(<div style={{ width: 320 }}><Tree aria-label="T" nodes={nodes} onMove={() => {}} /></div>);
  const at = hold(rowOf('Snap (snap)'), rowOf('Bee'), 0.3, 0.5);
  const parts = ghost().querySelector('i')!;
  const range = document.createRange();
  range.setStart(parts.previousSibling!, 0);
  range.setEnd(parts.previousSibling!, 4);
  expect(parts.getBoundingClientRect().left - range.getBoundingClientRect().right).toBeGreaterThan(1);
  act(() => { document.dispatchEvent(event('pointerup', at.x, at.y)); });
});

test('the ghost draws in the face of the tree it was dragged from, not of the page it portals to', () => {
  render(<div style={{ width: 320, fontFamily: 'monospace' }}><Tree aria-label="T" nodes={NODES} onMove={() => {}} /></div>);
  const at = hold(rowOf('Zed'), rowOf('Group'), 0.3, 0.5);
  expect(getComputedStyle(document.body).fontFamily).not.toBe('monospace');
  expect(getComputedStyle(ghost().firstElementChild!).fontFamily).toBe('monospace');
  act(() => { document.dispatchEvent(event('pointerup', at.x, at.y)); });
});
