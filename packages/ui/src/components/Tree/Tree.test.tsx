import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Tree, filterTree, treeBranchIds, type TreeNode } from './Tree';

afterEach(() => { cleanup(); });

const NODES: readonly TreeNode[] = [
  {
    id: 'fruit',
    label: 'Fruit',
    children: [
      { id: 'apple', label: 'Apple' },
      { id: 'banana', label: 'Banana' },
      {
        id: 'citrus',
        label: 'Citrus',
        children: [
          { id: 'lemon', label: 'Lemon' },
          { id: 'lime', label: 'Lime' },
        ],
      },
    ],
  },
  { id: 'veg', label: 'Vegetables', children: [{ id: 'kale', label: 'Kale' }] },
  { id: 'water', label: 'Water' },
];

const item = (name: string) => screen.getByRole('treeitem', { name });
const focused = () => document.activeElement;
const key = (k: string, opts: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(document.activeElement!, { key: k, ...opts });

describe('Tree — semantics', () => {
  it('renders a tree of treeitems with levels, and nests children in groups', () => {
    render(<Tree aria-label="Food" nodes={NODES} defaultExpandedIds={['fruit']} />);
    const tree = screen.getByRole('tree', { name: 'Food' });
    expect(tree).toBeInTheDocument();
    expect(item('Fruit')).toHaveAttribute('aria-level', '1');
    expect(item('Apple')).toHaveAttribute('aria-level', '2');
    const group = screen.getByRole('group');
    expect(item('Fruit')).toContainElement(group);
    expect(group).toContainElement(item('Apple'));
  });

  it('marks branches with aria-expanded and leaves without it', () => {
    render(<Tree aria-label="Food" nodes={NODES} defaultExpandedIds={['fruit']} />);
    expect(item('Fruit')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Vegetables')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Water')).not.toHaveAttribute('aria-expanded');
  });

  it('does not render the children of a collapsed branch', () => {
    render(<Tree aria-label="Food" nodes={NODES} />);
    expect(screen.queryByText('Apple')).toBeNull();
    expect(screen.queryByText('Kale')).toBeNull();
  });

  it('reports aria-selected only when the tree is selectable', () => {
    const { rerender } = render(<Tree aria-label="Food" nodes={NODES} />);
    expect(item('Water')).not.toHaveAttribute('aria-selected');
    rerender(<Tree aria-label="Food" nodes={NODES} selectionMode="single" selectedIds={['water']} />);
    expect(item('Water')).toHaveAttribute('aria-selected', 'true');
    expect(item('Fruit')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tree')).not.toHaveAttribute('aria-multiselectable');
  });

  it('sets aria-multiselectable for multiple selection', () => {
    render(<Tree aria-label="Food" nodes={NODES} selectionMode="multiple" />);
    expect(screen.getByRole('tree')).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('draws the twisty and hides it from assistive tech', () => {
    render(<Tree aria-label="Food" nodes={NODES} />);
    const svg = item('Fruit').querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.querySelector('path')).not.toBeNull();
    expect(item('Fruit').querySelector('button')).toBeNull();
    expect(item('Fruit').textContent).not.toMatch(/[▸▾▶▼]/);
  });

  it('puts leading and trailing content around the label, and marks muted and disabled rows', () => {
    render(
      <Tree
        aria-label="Food"
        nodes={[{
          id: 'a', label: 'Apple', muted: true, disabled: true,
          leading: <span data-testid="icon" />, trailing: <span data-testid="count">3</span>,
        }]}
      />,
    );
    const row = item('Apple 3');
    expect(row).toContainElement(screen.getByTestId('icon'));
    expect(row).toContainElement(screen.getByTestId('count'));
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(row).toHaveAttribute('data-muted', 'true');
  });

  it('shows the empty slot when there are no nodes', () => {
    render(<Tree aria-label="Food" nodes={[]} empty="Nothing matches" />);
    expect(screen.getByText('Nothing matches')).toBeInTheDocument();
  });
});

describe('Tree — expansion', () => {
  it('toggles a branch when its row is clicked (uncontrolled)', () => {
    const onExpandedChange = vi.fn();
    render(<Tree aria-label="Food" nodes={NODES} onExpandedChange={onExpandedChange} />);
    fireEvent.click(screen.getByText('Fruit'));
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(onExpandedChange).toHaveBeenLastCalledWith(new Set(['fruit']));
    fireEvent.click(screen.getByText('Fruit'));
    expect(screen.queryByText('Apple')).toBeNull();
  });

  it('toggles a branch from its twisty without activating the row', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Food" nodes={NODES} onAction={onAction} selectionMode="single" />);
    fireEvent.click(item('Fruit').querySelector('svg')!);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
    expect(item('Fruit')).toHaveAttribute('aria-selected', 'false');
  });

  it('follows expandedIds when controlled and reports requests through onExpandedChange', () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <Tree aria-label="Food" nodes={NODES} expandedIds={[]} onExpandedChange={onExpandedChange} />,
    );
    fireEvent.click(screen.getByText('Fruit'));
    expect(onExpandedChange).toHaveBeenCalledWith(new Set(['fruit']));
    expect(screen.queryByText('Apple')).toBeNull();
    rerender(<Tree aria-label="Food" nodes={NODES} expandedIds={new Set(['fruit', 'citrus'])} />);
    expect(screen.getByText('Lemon')).toBeInTheDocument();
  });
});

describe('Tree — selection', () => {
  it('selects a row on click (single, uncontrolled) and reports it', () => {
    const onSelectionChange = vi.fn();
    render(
      <Tree aria-label="Food" nodes={NODES} selectionMode="single" onSelectionChange={onSelectionChange} />,
    );
    fireEvent.click(screen.getByText('Water'));
    expect(item('Water')).toHaveAttribute('aria-selected', 'true');
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['water']));
    fireEvent.click(screen.getByText('Vegetables'));
    expect(item('Water')).toHaveAttribute('aria-selected', 'false');
    expect(item('Vegetables')).toHaveAttribute('aria-selected', 'true');
  });

  it('does not select a disabled row', () => {
    const onSelectionChange = vi.fn();
    render(
      <Tree
        aria-label="Food"
        nodes={[{ id: 'a', label: 'A', disabled: true }]}
        selectionMode="single"
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(screen.getByText('A'));
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('toggles with Cmd/Ctrl-click and extends a range with Shift-click (multiple)', () => {
    const onSelectionChange = vi.fn();
    render(
      <Tree
        aria-label="Food"
        nodes={NODES}
        selectionMode="multiple"
        defaultExpandedIds={['fruit']}
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(screen.getByText('Apple'));
    fireEvent.click(screen.getByText('Water'), { metaKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['apple', 'water']));
    fireEvent.click(screen.getByText('Apple'), { ctrlKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['water']));
    fireEvent.click(screen.getByText('Apple'));
    fireEvent.click(screen.getByText('Citrus'), { shiftKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['apple', 'banana', 'citrus']));
  });

  it('calls onAction for every activated row, with modifiers', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Food" nodes={NODES} onAction={onAction} />);
    fireEvent.click(screen.getByText('Water'), { altKey: true });
    expect(onAction).toHaveBeenCalledWith('water', expect.objectContaining({ altKey: true }));
  });
});

describe('Tree — keyboard', () => {
  it('puts exactly one treeitem in the tab order: the first selected, else the first', () => {
    const { rerender } = render(<Tree aria-label="Food" nodes={NODES} />);
    const stops = () => screen.getAllByRole('treeitem').filter((el) => el.tabIndex === 0);
    expect(stops()).toEqual([item('Fruit')]);
    rerender(<Tree aria-label="Food" nodes={NODES} selectionMode="single" selectedIds={['water']} />);
    expect(stops()).toEqual([item('Water')]);
  });

  it('moves through visible rows with Up/Down and Home/End', () => {
    render(<Tree aria-label="Food" nodes={NODES} defaultExpandedIds={['fruit']} />);
    act(() => item('Fruit').focus());
    key('ArrowDown');
    expect(focused()).toBe(item('Apple'));
    key('ArrowDown'); key('ArrowDown'); key('ArrowDown');
    expect(focused()).toBe(item('Vegetables'));
    key('ArrowUp');
    expect(focused()).toBe(item('Citrus'));
    key('End');
    expect(focused()).toBe(item('Water'));
    key('ArrowDown');
    expect(focused()).toBe(item('Water'));
    key('Home');
    expect(focused()).toBe(item('Fruit'));
  });

  it('Right expands a closed branch, then enters it; on a leaf it does nothing', () => {
    render(<Tree aria-label="Food" nodes={NODES} />);
    act(() => item('Fruit').focus());
    key('ArrowRight');
    expect(item('Fruit')).toHaveAttribute('aria-expanded', 'true');
    expect(focused()).toBe(item('Fruit'));
    key('ArrowRight');
    expect(focused()).toBe(item('Apple'));
    key('ArrowRight');
    expect(focused()).toBe(item('Apple'));
  });

  it('Left collapses an open branch, else moves to the parent', () => {
    render(<Tree aria-label="Food" nodes={NODES} defaultExpandedIds={['fruit', 'citrus']} />);
    act(() => item('Lime').focus());
    key('ArrowLeft');
    expect(focused()).toBe(item('Citrus'));
    key('ArrowLeft');
    expect(item('Citrus')).toHaveAttribute('aria-expanded', 'false');
    key('ArrowLeft');
    expect(focused()).toBe(item('Fruit'));
    key('ArrowLeft');
    expect(item('Fruit')).toHaveAttribute('aria-expanded', 'false');
  });

  it('skips children of a collapsed branch', () => {
    render(<Tree aria-label="Food" nodes={NODES} />);
    act(() => item('Fruit').focus());
    key('ArrowDown');
    expect(focused()).toBe(item('Vegetables'));
  });

  it('Enter and Space activate: select, toggle a branch, and call onAction', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Food" nodes={NODES} selectionMode="single" onAction={onAction} />);
    act(() => item('Water').focus());
    key('Enter');
    expect(item('Water')).toHaveAttribute('aria-selected', 'true');
    expect(onAction).toHaveBeenCalledWith('water', expect.anything());
    act(() => item('Fruit').focus());
    key(' ');
    expect(item('Fruit')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Fruit')).toHaveAttribute('aria-selected', 'true');
  });

  it('moves focus to the next visible row whose text starts with what is typed', () => {
    render(<Tree aria-label="Food" nodes={NODES} defaultExpandedIds={['fruit']} />);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      act(() => item('Fruit').focus());
      key('b');
      expect(focused()).toBe(item('Banana'));
      key('a');
      expect(focused()).toBe(item('Banana'));
      vi.advanceTimersByTime(1000);
      key('w');
      expect(focused()).toBe(item('Water'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the tab stop on the last focused row across rerenders', () => {
    function Harness() {
      const [n, setN] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setN(n + 1)}>bump</button>
          <Tree aria-label="Food" nodes={NODES} />
        </>
      );
    }
    render(<Harness />);
    act(() => item('Water').focus());
    fireEvent.click(screen.getByText('bump'));
    expect(item('Water').tabIndex).toBe(0);
    expect(item('Fruit').tabIndex).toBe(-1);
  });
});

describe('filterTree / treeBranchIds', () => {
  it('keeps matches and their ancestors, dropping branches with no match', () => {
    const out = filterTree(NODES, (n) => !n.children && String(n.label).toLowerCase().includes('li'));
    expect(out.map((n) => n.id)).toEqual(['fruit']);
    expect(out[0].children!.map((n) => n.id)).toEqual(['citrus']);
    expect(out[0].children![0].children!.map((n) => n.id)).toEqual(['lime']);
  });

  it('keeps a matching branch with its whole subtree', () => {
    const out = filterTree(NODES, (n) => n.id === 'citrus');
    expect(out[0].children![0].children!.map((n) => n.id)).toEqual(['lemon', 'lime']);
  });

  it('returns the same array when nothing is dropped', () => {
    expect(filterTree(NODES, () => true)).toBe(NODES);
  });

  it('lists every branch id, depth first', () => {
    expect(treeBranchIds(NODES)).toEqual(['fruit', 'citrus', 'veg']);
  });
});
