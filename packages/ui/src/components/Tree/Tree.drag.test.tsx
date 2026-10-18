import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { renderWithIcons } from '../../testing/withIcons';
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
  renderWithIcons(<Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} selectionMode="single" onMove={onMove} {...props} />);
  const tree = screen.getByRole('tree');
  tree.setPointerCapture = vi.fn();
  tree.releasePointerCapture = vi.fn();
  stamp(tree);
  const row = (name: string) => screen.getByRole('treeitem', { name }).firstElementChild as HTMLElement;
  return { onMove, tree, row };
}

const press = (el: HTMLElement, y: number, x = 100) =>
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: x, clientY: y });
const move = (y: number, x = 100, altKey = false, metaKey = false) => fireEvent.pointerMove(document, { pointerId: 1, clientX: x, clientY: y, altKey, metaKey });
const release = (y: number, x = 100, altKey = false, metaKey = false) => fireEvent.pointerUp(document, { pointerId: 1, clientX: x, clientY: y, altKey, metaKey });

describe('Tree — drag threshold', () => {
  it('picks a row up only past the gestures.dragPx kit setting', () => {
    const onMove = vi.fn();
    renderWithIcons(
      <KitSettingsProvider value={{ gestures: { dragPx: 40 } }}>
        <Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} selectionMode="single" onMove={onMove} />
      </KitSettingsProvider>,
    );
    const tree = screen.getByRole('tree');
    tree.setPointerCapture = vi.fn();
    tree.releasePointerCapture = vi.fn();
    stamp(tree);
    press(screen.getByRole('treeitem', { name: 'Zed' }).firstElementChild as HTMLElement, 80);
    move(50);
    expect(screen.getAllByText('Zed')).toHaveLength(1);
    move(30);
    expect(screen.getAllByText('Zed')).toHaveLength(2);
    release(30);
  });
});

describe('Tree — drag ghost', () => {
  it('names a carried row that is hidden in a collapsed branch by its label', () => {
    const { row } = setup({ selectionMode: 'multiple', selectedIds: ['x', 'z'], defaultExpandedIds: [] });
    press(row('Zed'), 30);
    move(60);
    expect(screen.getByText('Ex')).toBeInTheDocument();
    release(60);
  });
});

describe('Tree — a ghost the caller draws', () => {
  const boxed = (tree: HTMLElement) => {
    tree.getBoundingClientRect = () => ({ top: 0, left: 0, right: 200, bottom: 96, width: 200, height: 96, x: 0, y: 0 }) as DOMRect;
  };

  it('draws what renderGhost returns in place of the rows, and says whether the pointer has left the tree', () => {
    const renderGhost = vi.fn((ids: readonly string[], where: { outside: boolean }) =>
      where.outside ? { content: <span>stand-in for {ids.join()}</span>, width: 300 } : null);
    const { row, tree } = setup({ renderGhost });
    boxed(tree);
    press(row('Zed'), 80);
    move(60);
    // Inside the tree the caller declined, so the rows are drawn.
    expect(renderGhost).toHaveBeenLastCalledWith(['z'], { outside: false, effect: 'move' });
    expect(screen.queryByText('stand-in for z')).toBeNull();
    expect(screen.getAllByText('Zed')).toHaveLength(2);

    move(60, 400);
    expect(renderGhost).toHaveBeenLastCalledWith(['z'], { outside: true, effect: 'move' });
    const ghost = screen.getByText('stand-in for z').parentElement!;
    expect(screen.getAllByText('Zed')).toHaveLength(1);
    // Its corner sits beside the pointer and a row's height under it, at the width asked for.
    expect([ghost.style.left, ghost.style.top, ghost.style.width]).toEqual(['410px', `${60 + ROW}px`, '300px']);
    release(60, 400);
    expect(screen.queryByText('stand-in for z')).toBeNull();
  });

  it('draws nothing of the caller\'s while `ghost` is off', () => {
    const renderGhost = () => ({ content: <span>stand-in</span>, width: 300 });
    const { row } = setup({ renderGhost, ghost: false });
    press(row('Zed'), 80);
    move(60, 400);
    expect(screen.queryByText('stand-in')).toBeNull();
    release(60, 400);
  });
});

describe('Tree — drag to copy', () => {
  it('copies on a drag released with Alt held, and moves nothing', () => {
    const onCopy = vi.fn();
    const { onMove, row } = setup({ onCopy });
    press(row('Zed'), 80);
    move(30, 100, true);
    expect(screen.getByRole('tree')).toHaveAttribute('data-drag-effect', 'copy');
    // The rows stay, so they are not drawn as lifted.
    expect(screen.getByRole('treeitem', { name: 'Zed' })).not.toHaveAttribute('data-dragging');
    release(30, 100, true);
    expect(onCopy).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('takes a copy where a move would be nothing: beside the row itself', () => {
    const onCopy = vi.fn();
    const { onMove, row } = setup({ onCopy });
    press(row('Zed'), 80);
    move(92, 100, true);     // lower half of Zed itself
    release(92, 100, true);
    expect(onCopy).toHaveBeenCalledWith(['z'], { parentId: null, index: 2 });
    release(92);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('goes by Alt at the release, and follows the key while the pointer is still', () => {
    const onCopy = vi.fn();
    const { onMove, row } = setup({ onCopy });
    press(row('Zed'), 80);
    move(30);
    fireEvent.keyDown(window, { key: 'Alt', altKey: true });
    expect(screen.getByRole('tree')).toHaveAttribute('data-drag-effect', 'copy');
    fireEvent.keyUp(window, { key: 'Alt' });
    expect(screen.getByRole('tree')).not.toHaveAttribute('data-drag-effect');
    release(30);
    expect(onMove).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('moves under Alt in a tree that takes no copies', () => {
    const { onMove, row } = setup();
    press(row('Zed'), 80);
    move(30, 100, true);
    expect(screen.getByRole('tree')).not.toHaveAttribute('data-drag-effect');
    release(30, 100, true);
    expect(onMove).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
  });

  it('links on a drag released with Alt and Cmd held, in a tree that takes links', () => {
    const onCopy = vi.fn();
    const onLink = vi.fn();
    const { onMove, row } = setup({ onCopy, onLink });
    press(row('Zed'), 80);
    move(30, 100, true, true);
    expect(screen.getByRole('tree')).toHaveAttribute('data-drag-effect', 'link');
    expect(screen.getByRole('treeitem', { name: 'Zed' })).not.toHaveAttribute('data-dragging');
    release(30, 100, true, true);
    expect(onLink).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
    expect(onCopy).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('copies under Alt and Cmd in a tree that takes copies and no links', () => {
    const onCopy = vi.fn();
    const { row } = setup({ onCopy });
    press(row('Zed'), 80);
    move(30, 100, true, true);
    release(30, 100, true, true);
    expect(onCopy).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
  });

  it('tells canDrop the drag is a copy', () => {
    const canDrop = vi.fn(() => true);
    const { row } = setup({ onCopy: vi.fn(), canDrop });
    press(row('Zed'), 80);
    move(30, 100, true);
    expect(canDrop).toHaveBeenLastCalledWith(['z'], { parentId: 'g', index: 0 }, 'copy');
    release(30, 100, true);
  });
});

describe('Tree — drag to reorder', () => {
  it('is off without onMove: no drag starts', () => {
    const { row } = setup({ onMove: undefined });
    press(row('Zed'), 80);
    move(10);
    expect(screen.getByRole('treeitem', { name: 'Zed' })).not.toHaveAttribute('data-dragging');
    expect(screen.getAllByText('Zed')).toHaveLength(1);
    release(10);
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

  it('drops the drag on Escape: the rows stay, the marks clear, and a later release moves nothing', () => {
    const { onMove, row } = setup();
    press(row('Zed'), 80);
    move(30);
    expect(screen.getByRole('treeitem', { name: 'Zed' })).toHaveAttribute('data-dragging', 'true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('treeitem', { name: 'Zed' })).not.toHaveAttribute('data-dragging');
    expect(screen.getByRole('treeitem', { name: 'Ex' })).not.toHaveAttribute('data-drop');
    release(30);
    expect(onMove).not.toHaveBeenCalled();
    // The hook is free again, so the next press starts a drag of its own.
    press(row('Zed'), 80);
    move(30);
    expect(screen.getByRole('treeitem', { name: 'Zed' })).toHaveAttribute('data-dragging', 'true');
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
    expect(canDrop).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 }, 'move');
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
    act(() => { vi.advanceTimersByTime(600); });
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
    const { rerender } = renderWithIcons(<Tree aria-label="T" nodes={NODES} onMove={vi.fn()} ref={cb} />);
    rerender(<Tree aria-label="T" nodes={NODES} onMove={vi.fn()} ref={cb} />);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toBe(screen.getByRole('tree'));
  });

  it('points a ref at the tree once nodes arrive after an empty mount', () => {
    const ref = createRef<HTMLUListElement>();
    const { rerender } = renderWithIcons(<Tree aria-label="T" nodes={[]} ref={ref} />);
    expect(ref.current).toBeNull();
    rerender(<Tree aria-label="T" nodes={NODES} ref={ref} />);
    expect(ref.current).toBe(screen.getByRole('tree'));
    rerender(<Tree aria-label="T" nodes={[]} ref={ref} />);
    expect(ref.current).toBeNull();
  });

  it('draws no drop mark where a drop would leave the row in place', () => {
    const { tree, row } = setup();
    press(row('Ex'), 30);
    move(60);
    move(30);
    expect(screen.getByRole('treeitem', { name: 'Ex' })).toHaveAttribute('data-dragging', 'true');
    expect(tree.querySelector('[data-drop]')).toBeNull();
  });
});

describe('Tree — keyboard moves', () => {
  const focusOn = (name: string) => act(() => screen.getByRole('treeitem', { name }).focus());
  const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k, altKey: true });
  /** Past the frame a move has to land in before the tree stops waiting to refocus its node. */
  const frame = () => act(async () => { await new Promise<void>((done) => { requestAnimationFrame(() => done()); }); });

  it('moves among siblings with Alt+Up/Down', () => {
    const { onMove } = setup();
    focusOn('Why');
    key('ArrowUp');
    expect(onMove).toHaveBeenLastCalledWith(['y'], { parentId: 'g', index: 0 });
  });

  it('outdents with Alt+Left and indents with Alt+Right', async () => {
    const { onMove } = setup();
    focusOn('Ex');
    key('ArrowLeft');
    expect(onMove).toHaveBeenLastCalledWith(['x'], { parentId: null, index: 1 });
    await frame();
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

  it('leaves focus alone on a later render when the move never changed the nodes', async () => {
    const { rerender } = renderWithIcons(<Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} onMove={() => {}} />);
    focusOn('Why');
    key('ArrowUp');
    await frame();
    focusOn('Zed');
    rerender(<Tree aria-label="T again" nodes={NODES} defaultExpandedIds={['g']} onMove={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Zed' }));
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
    renderWithIcons(<Live />);
    focusOn('Zed');
    key('ArrowRight');
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Zed' }));
  });
});
