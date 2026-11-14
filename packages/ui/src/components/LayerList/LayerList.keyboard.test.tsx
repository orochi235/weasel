import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayerList } from './LayerList';
import { BG, FLAT, list, row, TREE } from './layerList.fixture';

describe('LayerList keyboard', () => {
  it('is a tree with one row in the tab order while its rows have no toggles', () => {
    list({ items: TREE, selectedIds: ['b'], onSelectionChange: vi.fn() });
    expect(screen.getByRole('tree', { name: 'Layers' })).toBeInTheDocument();
    const tabbable = screen.getAllByRole('treeitem').filter((r) => r.tabIndex === 0);
    expect(tabbable).toEqual([row('Beta')]);
    expect(row('Group').getAttribute('aria-expanded')).toBe('true');
    expect(row('One').getAttribute('aria-level')).toBe('2');
  });

  it('is a treegrid once rows have toggles, each row owning only gridcells', () => {
    list({ items: TREE, onRemove: () => {}, selectedIds: ['b'], onSelectionChange: vi.fn() });
    expect(screen.getByRole('treegrid', { name: 'Layers' })).toHaveAttribute('aria-multiselectable', 'true');
    for (const r of screen.getAllByRole('row')) {
      const cells = Array.from(r.children);
      expect(cells.map((c) => c.getAttribute('role'))).toEqual(['gridcell', 'gridcell']);
    }
    expect(screen.getAllByRole('row').filter((r) => r.tabIndex === 0)).toEqual([row('Beta')]);
    expect(row('One').getAttribute('aria-level')).toBe('2');
    expect(row('Beta')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the toggles out of the tab order', () => {
    list({ onRemove: () => {}, onVisibilityChange: () => {}, onLockChange: () => {} });
    for (const name of ['Remove Alpha', 'Show Alpha', 'Lock Alpha']) expect(screen.getByLabelText(name)).toHaveAttribute('tabindex', '-1');
  });

  it('steps into the toggles with Right, across them, and back with Left or Escape', () => {
    list({ onVisibilityChange: () => {}, onRemove: () => {} });
    act(() => row('Beta').focus());
    fireEvent.keyDown(row('Beta'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByLabelText('Show Beta'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByLabelText('Remove Beta'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(row('Beta'));
    fireEvent.keyDown(row('Beta'), { key: 'ArrowRight' });
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.activeElement).toBe(row('Beta'));
  });

  it('moves between rows with Up and Down from a toggle', () => {
    list({ onVisibilityChange: () => {} });
    act(() => screen.getByLabelText('Show Beta').focus());
    fireEvent.keyDown(screen.getByLabelText('Show Beta'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('Gamma'));
  });

  it('opens a closed branch with Right before stepping into its toggles', () => {
    list({ items: TREE, collapsedIds: ['g'], onCollapsedChange: vi.fn(), onVisibilityChange: () => {} });
    act(() => row('Group').focus());
    fireEvent.keyDown(row('Group'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(row('Group'));
  });

  it('walks the visible rows with the arrows, Home and End', () => {
    list({ items: TREE });
    act(() => row('Group').focus());
    fireEvent.keyDown(row('Group'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('One'));
    fireEvent.keyDown(row('One'), { key: 'End' });
    expect(document.activeElement).toBe(row('Beta'));
    fireEvent.keyDown(row('Beta'), { key: 'Home' });
    expect(document.activeElement).toBe(row('Group'));
  });

  it('closes a branch on Left, opens it on Right, and steps to the parent from a child', () => {
    list({ items: TREE });
    act(() => row('One').focus());
    fireEvent.keyDown(row('One'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(row('Group'));
    fireEvent.keyDown(row('Group'), { key: 'ArrowLeft' });
    expect(screen.queryByText('One')).toBeNull();
    fireEvent.keyDown(row('Group'), { key: 'ArrowRight' });
    expect(screen.getByText('One')).toBeInTheDocument();
  });

  it('selects on Enter and Space, and adds with Cmd', () => {
    const onSelectionChange = vi.fn();
    list({ selectedIds: ['a'], onSelectionChange });
    fireEvent.keyDown(row('Beta'), { key: 'Enter' });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['b']);
    fireEvent.keyDown(row('Gamma'), { key: ' ', metaKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('selects a range with Shift+arrows, passing over a fixed row', () => {
    const onSelectionChange = vi.fn();
    list({ items: [...FLAT, BG], selectedIds: [], onSelectionChange });
    act(() => row('Beta').focus());
    fireEvent.keyDown(row('Beta'), { key: 'ArrowDown', shiftKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['b', 'c']);
    fireEvent.keyDown(row('Gamma'), { key: 'End', shiftKey: true });
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it('moves a row with Alt+arrows, as a drag of it would', () => {
    const onReorder = vi.fn();
    list({ onReorder });
    fireEvent.keyDown(row('Alpha'), { key: 'ArrowDown', altKey: true });
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a'], parentId: null, index: 1 });
  });

  it('moves a child among its siblings with Alt+Up, and out of its parent with Alt+Left', () => {
    const onReorder = vi.fn();
    list({ items: TREE, onReorder });
    fireEvent.keyDown(row('Two'), { key: 'ArrowUp', altKey: true });
    expect(onReorder).toHaveBeenLastCalledWith({ ids: ['g2'], parentId: 'g', index: 0 });
    fireEvent.keyDown(row('Two'), { key: 'ArrowLeft', altKey: true });
    expect(onReorder).toHaveBeenLastCalledWith({ ids: ['g2'], parentId: null, index: 1 });
  });

  it('moves no row past a fixed one with Alt+arrows', () => {
    const onReorder = vi.fn();
    list({ items: [...FLAT, BG], onReorder });
    fireEvent.keyDown(row('Gamma'), { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(row('Background'), { key: 'ArrowUp', altKey: true });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('leaves keys on a control inside a row to the control', () => {
    const onSelectionChange = vi.fn();
    list({ selectedIds: [], onSelectionChange, onVisibilityChange: vi.fn() });
    fireEvent.keyDown(screen.getByLabelText('Show Beta'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('Show Beta'), { key: ' ' });
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

describe('LayerList rename', () => {
  it('renames a row from a double-click on its label, committing on Enter', () => {
    const onRename = vi.fn();
    list({ onRename });
    fireEvent.doubleClick(screen.getByText('Alpha'));
    const field = screen.getByLabelText('Rename Alpha');
    fireEvent.change(field, { target: { value: 'First' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('a', 'First');
    expect(screen.queryByLabelText('Rename Alpha')).toBeNull();
    expect(document.activeElement).toBe(row('Alpha'));
  });

  it('leaves an input method\'s Enter to it while renaming', () => {
    const onRename = vi.fn();
    list({ onRename });
    fireEvent.doubleClick(screen.getByText('Alpha'));
    const field = screen.getByLabelText('Rename Alpha');
    fireEvent.change(field, { target: { value: 'にほ' } });
    for (const init of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }]) fireEvent.keyDown(field, init);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Rename Alpha')).toBe(field);
  });

  it('starts a rename with F2 on the focused row, and Escape drops it', () => {
    const onRename = vi.fn();
    list({ onRename, onVisibilityChange: vi.fn() });
    fireEvent.keyDown(row('Beta'), { key: 'F2' });
    const field = screen.getByLabelText('Rename Beta');
    fireEvent.change(field, { target: { value: 'Second' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByLabelText('Rename Beta')).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(row('Beta'));
  });

  it('commits a rename on blur, and ignores an empty or unchanged name', () => {
    const onRename = vi.fn();
    list({ onRename });
    fireEvent.doubleClick(screen.getByText('Alpha'));
    fireEvent.blur(screen.getByLabelText('Rename Alpha'));
    fireEvent.doubleClick(screen.getByText('Alpha'));
    fireEvent.change(screen.getByLabelText('Rename Alpha'), { target: { value: '  ' } });
    fireEvent.blur(screen.getByLabelText('Rename Alpha'));
    fireEvent.doubleClick(screen.getByText('Alpha'));
    fireEvent.change(screen.getByLabelText('Rename Alpha'), { target: { value: 'Al' } });
    fireEvent.blur(screen.getByLabelText('Rename Alpha'));
    expect(onRename.mock.calls).toEqual([['a', 'Al']]);
  });

  it('offers no rename on a fixed, locked, or unrenamable row, or without onRename', () => {
    const onRename = vi.fn();
    const { rerender } = list();
    fireEvent.doubleClick(screen.getByText('Alpha'));
    expect(screen.queryByLabelText('Rename Alpha')).toBeNull();
    const items = [{ id: 'a', label: 'Alpha', fixed: true }, { id: 'b', label: 'Beta', locked: true }, { id: 'c', label: 'Gamma', renamable: false }];
    rerender(<LayerList items={items} onRename={onRename} />);
    for (const label of ['Alpha', 'Beta', 'Gamma']) {
      fireEvent.doubleClick(screen.getByText(label));
      fireEvent.keyDown(row(label), { key: 'F2' });
      expect(screen.queryByLabelText(`Rename ${label}`)).toBeNull();
    }
  });
});
