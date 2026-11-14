import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tree, type TreeNode } from './Tree';

afterEach(cleanup);

const toggle = (name: string) => <button type="button" aria-label={`Hide ${name}`} />;
const NODES: TreeNode[] = [
  { id: 'g', label: 'Group', children: [{ id: 'x', label: 'Ex', controls: toggle('Ex') }] },
  { id: 'z', label: 'Zed', controls: toggle('Zed') },
];
const row = (name: string) => screen.getByText(name).closest<HTMLElement>('[role="row"]')!;

describe('Tree with row controls', () => {
  it('is a treegrid of rows, each owning only gridcells, its controls out of the tab order', () => {
    render(<Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} />);
    expect(screen.getByRole('treegrid', { name: 'T' })).toBeInTheDocument();
    expect(screen.queryByRole('treeitem')).toBeNull();
    for (const r of screen.getAllByRole('row')) {
      expect(Array.from(r.children).map((c) => c.getAttribute('role'))).toEqual(['gridcell', 'gridcell']);
    }
    expect(row('Group')).toHaveAttribute('aria-expanded', 'true');
    expect(row('Ex')).toHaveAttribute('aria-level', '2');
    expect(row('Ex').closest('li')).toHaveAttribute('role', 'none');
    expect(row('Ex').closest('ul')).toHaveAttribute('role', 'none');
    expect(screen.getByLabelText('Hide Zed')).toHaveAttribute('tabindex', '-1');
    expect(screen.getAllByRole('row').filter((r) => r.tabIndex === 0)).toEqual([row('Group')]);
  });

  it('leaves a click on a control to the control', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="T" nodes={NODES} selectionMode="single" onAction={onAction} />);
    fireEvent.click(screen.getByLabelText('Hide Zed'));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Zed'));
    expect(onAction).toHaveBeenCalledWith('z', expect.anything());
  });

  it('steps into a leaf\'s controls with Right, and into an open branch with none', () => {
    render(<Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} />);
    act(() => row('Group').focus());
    fireEvent.keyDown(row('Group'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(row('Ex'));
    fireEvent.keyDown(row('Ex'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByLabelText('Hide Ex'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('Zed'));
  });
});

describe('Tree node flags', () => {
  it('moves no immovable node, by keyboard or by drag', () => {
    const onMove = vi.fn();
    const nodes: TreeNode[] = [{ id: 'a', label: 'A', immovable: true }, { id: 'b', label: 'B' }];
    render(<Tree aria-label="T" nodes={nodes} onMove={onMove} />);
    const a = screen.getByRole('treeitem', { name: 'A' });
    fireEvent.keyDown(a, { key: 'ArrowDown', altKey: true });
    fireEvent.pointerDown(a.firstElementChild!, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 0, clientY: 60 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 0, clientY: 60 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('selects a node that selects alone on its own, under any modifier', () => {
    const onSelectionChange = vi.fn();
    const nodes: TreeNode[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', selectsAlone: true }];
    render(<Tree aria-label="T" nodes={nodes} selectionMode="multiple" selectedIds={['a']} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getByText('B'), { metaKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['b']));
  });

  it('hands a row\'s keys and right-clicks to the consumer first', () => {
    const onRowContextMenu = vi.fn();
    const onAction = vi.fn();
    const onRowKeyDown = vi.fn((_id: string, e: { key: string; preventDefault(): void }) => {
      if (e.key === 'Enter') e.preventDefault();
    });
    render(<Tree aria-label="T" nodes={NODES} onAction={onAction} onRowKeyDown={onRowKeyDown} onRowContextMenu={onRowContextMenu} />);
    fireEvent.keyDown(row('Zed'), { key: 'Enter' });
    expect(onRowKeyDown).toHaveBeenCalledWith('z', expect.anything());
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.contextMenu(screen.getByText('Zed'));
    expect(onRowContextMenu).toHaveBeenCalledWith('z', expect.anything());
  });
});
