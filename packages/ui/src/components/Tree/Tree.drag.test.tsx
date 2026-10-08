import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tree, type TreeNode } from './Tree';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NODES: TreeNode[] = [
  { id: 'g', label: 'Group', children: [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }] },
  { id: 'z', label: 'Zed' },
];
const ROW = 24;

/** Stamp each visible row's box, in document order, as real layout would. */
function stamp(tree: HTMLElement) {
  const items = Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'));
  items.forEach((li, i) => {
    const level = Number(li.getAttribute('aria-level'));
    const row = li.firstElementChild as HTMLElement;
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: i * ROW, height: ROW, left: (level - 1) * 16, width: 200, bottom: (i + 1) * ROW, right: 200, x: 0, y: i * ROW } as DOMRect),
    });
  });
}

function setup(props: Partial<Parameters<typeof Tree>[0]> = {}) {
  const onMove = vi.fn();
  render(<Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} selectionMode="single" onMove={onMove} {...props} />);
  const tree = screen.getByRole('tree');
  tree.setPointerCapture = vi.fn();
  tree.releasePointerCapture = vi.fn();
  stamp(tree);
  const row = (name: string) => screen.getByRole('treeitem', { name }).firstElementChild as HTMLElement;
  return { onMove, tree, row };
}

const press = (el: HTMLElement, y: number, x = 100) =>
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: x, clientY: y });
const move = (y: number, x = 100) => fireEvent.pointerMove(document, { pointerId: 1, clientX: x, clientY: y });
const release = (y: number, x = 100) => fireEvent.pointerUp(document, { pointerId: 1, clientX: x, clientY: y });

describe('Tree — drag to reorder', () => {
  it('is off without onMove: no drag starts', () => {
    const { row } = setup({ onMove: undefined });
    press(row('Zed'), 80);
    move(10);
    release(10);
    expect(screen.getByRole('treeitem', { name: 'Zed' })).not.toHaveAttribute('data-dragging');
  });

  it('moves a node before another across parents', () => {
    const { onMove, row } = setup();
    press(row('Zed'), 80);   // z is the 4th visible row: 72–96
    move(30);                // upper half of Ex (24–48)
    release(30);
    expect(onMove).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
  });

  it('marks the target row while dragging and clears it on drop', () => {
    const { row } = setup();
    press(row('Zed'), 80);
    move(30);
    expect(screen.getByRole('treeitem', { name: 'Ex' })).toHaveAttribute('data-drop', 'before');
    expect(screen.getByRole('treeitem', { name: 'Zed' })).toHaveAttribute('data-dragging', 'true');
    release(30);
    expect(screen.getByRole('treeitem', { name: 'Ex' })).not.toHaveAttribute('data-drop');
  });

  it('refuses a drop into the dragged node itself even when canDrop allows everything', () => {
    const canDrop = vi.fn(() => true);
    const { onMove, row } = setup({ canDrop });
    press(row('Group'), 10);
    move(40);                // onto Ex, a child of g
    expect(screen.getByRole('treeitem', { name: 'Group' })).toHaveAttribute('data-dragging', 'true');
    release(40);
    expect(canDrop).not.toHaveBeenCalled(); // the built-in refusal runs before canDrop
    expect(onMove).not.toHaveBeenCalled();
  });

  it('asks canDrop and draws no mark for a refused target', () => {
    const canDrop = vi.fn(() => false);
    const { onMove, row } = setup({ canDrop });
    press(row('Zed'), 80);
    move(30);
    expect(canDrop).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
    expect(screen.getByRole('treeitem', { name: 'Ex' })).not.toHaveAttribute('data-drop');
    release(30);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('still selects on a press that never drags', () => {
    const onSelectionChange = vi.fn();
    const { row } = setup({ onSelectionChange });
    press(row('Zed'), 80);
    release(80);
    fireEvent.click(row('Zed'));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect([...onSelectionChange.mock.calls[0]![0]]).toEqual(['z']);
  });

  it('opens a collapsed branch held over for 600ms', () => {
    vi.useFakeTimers();
    const onExpandedChange = vi.fn();
    const { row } = setup({ defaultExpandedIds: [], onExpandedChange });
    // collapsed: rows are Group (0–24), Zed (24–48)
    press(row('Zed'), 40);
    move(12);
    vi.advanceTimersByTime(600);
    expect([...onExpandedChange.mock.calls.at(-1)![0]]).toEqual(['g']);
  });

  it('does not start a drag from a disabled node', () => {
    const nodes: TreeNode[] = [{ id: 'a', label: 'Aye', disabled: true }, { id: 'b', label: 'Bee' }];
    const canDrop = vi.fn(() => true);
    const { onMove, row } = setup({ nodes, canDrop });
    press(row('Aye'), 10);
    move(40);
    expect(screen.getByRole('treeitem', { name: 'Aye' })).not.toHaveAttribute('data-dragging');
    release(40);
    expect(canDrop).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('calls a stable callback ref once across a rerender', () => {
    const cb = vi.fn();
    const { rerender } = render(<Tree aria-label="T" nodes={NODES} onMove={vi.fn()} ref={cb} />);
    rerender(<Tree aria-label="T" nodes={NODES} onMove={vi.fn()} ref={cb} />);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toBe(screen.getByRole('tree'));
  });
});

describe('Tree — keyboard moves', () => {
  const focusOn = (name: string) => screen.getByRole('treeitem', { name }).focus();
  const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k, altKey: true });

  it('moves among siblings with Alt+Up/Down', () => {
    const { onMove } = setup();
    focusOn('Why');
    key('ArrowUp');
    expect(onMove).toHaveBeenLastCalledWith(['y'], { parentId: 'g', index: 0 });
  });

  it('outdents with Alt+Left and indents with Alt+Right', () => {
    const { onMove } = setup();
    focusOn('Ex');
    key('ArrowLeft');
    expect(onMove).toHaveBeenLastCalledWith(['x'], { parentId: null, index: 1 });
    focusOn('Zed');
    key('ArrowRight');
    expect(onMove).toHaveBeenLastCalledWith(['z'], { parentId: 'g', index: 2 });
  });

  it('routes keyboard moves through canDrop', () => {
    const { onMove } = setup({ canDrop: () => false });
    focusOn('Why');
    key('ArrowUp');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('treats Alt+arrows as plain navigation without onMove', () => {
    setup({ onMove: undefined });
    focusOn('Ex');
    key('ArrowLeft');
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Group' }));
  });

  it('keeps focus on the moved node after it remounts under its new parent', () => {
    function Live() {
      const [nodes, setNodes] = useState<TreeNode[]>(NODES);
      return (
        <Tree aria-label="T" nodes={nodes} defaultExpandedIds={['g']} onMove={(ids, t) => {
          // test-only: move z into g at t.index
          if (ids[0] === 'z' && t.parentId === 'g') setNodes([{ ...NODES[0]!, children: [...NODES[0]!.children!, NODES[1]!] }]);
        }} />
      );
    }
    render(<Live />);
    focusOn('Zed');
    key('ArrowRight');
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Zed' }));
  });
});
