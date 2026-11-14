import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { LayerList, type LayerListItem, moveLayers } from './LayerList';
import { BG, click, drag, FLAT, list, ROW_H, row, stampRows, TREE } from './layerList.fixture';

stampRows();

describe('LayerList rows', () => {
  it('renders one row per layer', () => {
    list();
    for (const label of ['Alpha', 'Beta', 'Gamma']) expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows the empty node when there are no layers', () => {
    list({ items: [], empty: 'No nodes' });
    expect(screen.getByText('No nodes')).toBeInTheDocument();
  });

  it('points at the palette when empty, and only when there is one', () => {
    const { rerender } = list({ items: [] });
    expect(screen.getByText('No layers.')).toBeInTheDocument();
    rerender(<LayerList items={[]} addKinds={['fill']} onAdd={() => {}} />);
    expect(screen.getByText(/add one above/)).toBeInTheDocument();
  });

  it('draws a leading node before the label', () => {
    list({ items: [{ id: 'a', label: 'Alpha', leading: <i data-testid="swatch" /> }] });
    const swatch = screen.getByTestId('swatch');
    expect(swatch.compareDocumentPosition(screen.getByText('Alpha')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('appends className to the root, keeping its own class', () => {
    const { container } = list({ className: 'host' });
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains('host')).toBe(true);
    expect(root.classList.length).toBeGreaterThan(1);
  });

  it('marks a fixed row with a lock, named as part of the row', () => {
    list({ items: [...FLAT, BG], onReorder: vi.fn() });
    expect(screen.getAllByRole('img', { name: 'Locked' })).toHaveLength(1);
    expect(row('Background')).toHaveAccessibleName('Background Locked');
  });
});

describe('LayerList selection', () => {
  it('selects the clicked row', () => {
    const onSelectionChange = vi.fn();
    list({ selectedIds: [], onSelectionChange });
    click('Beta');
    expect(onSelectionChange).toHaveBeenLastCalledWith(['b']);
  });

  it('selects from the committed props, not an abandoned render\'s', () => {
    const committed = { selectedIds: ['a'], onSelectionChange: vi.fn() };
    const abandoned = { selectedIds: ['c'], onSelectionChange: vi.fn() };
    renderThenAbandon(committed, abandoned, (p) => <LayerList items={FLAT} {...p} />);
    click('Beta', { metaKey: true });
    expect(abandoned.onSelectionChange).not.toHaveBeenCalled();
    expect(committed.onSelectionChange).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('adds and removes a row on Cmd-click and on Ctrl-click', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = list({ selectedIds: ['a'], onSelectionChange });
    click('Gamma', { metaKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'c']);
    rerender(<LayerList items={FLAT} selectedIds={['a', 'c']} onSelectionChange={onSelectionChange} />);
    click('Alpha', { ctrlKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['c']);
  });

  it('selects every row from the last click to a shift-click', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = list({ selectedIds: [], onSelectionChange });
    click('Alpha');
    rerender(<LayerList items={FLAT} selectedIds={['a']} onSelectionChange={onSelectionChange} />);
    click('Gamma', { shiftKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c']);
  });

  it('ranges over the rows that are showing, not a collapsed branch\'s children', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = list({ items: TREE, collapsedIds: ['g'], selectedIds: [], onSelectionChange });
    click('Group');
    rerender(<LayerList items={TREE} collapsedIds={['g']} selectedIds={['g']} onSelectionChange={onSelectionChange} />);
    click('Beta', { shiftKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['g', 'b']);
  });

  it('selects a fixed row alone, on Cmd-click and on Shift-click', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = list({ items: [...FLAT, BG], selectedIds: ['a'], onSelectionChange });
    click('Background', { metaKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['bg']);
    rerender(<LayerList items={[...FLAT, BG]} selectedIds={['a']} onSelectionChange={onSelectionChange} />);
    click('Background', { shiftKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['bg']);
  });

  it('drops a fixed row from the selection a Cmd-click builds on', () => {
    const onSelectionChange = vi.fn();
    list({ items: [...FLAT, BG], selectedIds: ['bg'], onSelectionChange });
    click('Beta', { metaKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['b']);
  });

  it('passes over a fixed row inside a shift-click range', () => {
    const onSelectionChange = vi.fn();
    const items = [FLAT[0]!, BG, FLAT[2]!];
    const { rerender } = list({ items, selectedIds: [], onSelectionChange });
    click('Alpha');
    rerender(<LayerList items={items} selectedIds={['a']} onSelectionChange={onSelectionChange} />);
    click('Gamma', { shiftKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('marks the selected row', () => {
    list({ selectedIds: ['b'], onSelectionChange: vi.fn() });
    expect(row('Beta')).toHaveAttribute('aria-selected', 'true');
    expect(row('Alpha')).toHaveAttribute('aria-selected', 'false');
  });

  it('does not select a row when a press lands on its checkbox', () => {
    const onSelectionChange = vi.fn();
    const onVisibilityChange = vi.fn();
    list({ selectedIds: [], onSelectionChange, onVisibilityChange, onReorder: vi.fn() });
    fireEvent.pointerDown(screen.getByLabelText('Show Beta'), { pointerId: 1, button: 0, isPrimary: true });
    fireEvent.pointerUp(document, { pointerId: 1 });
    fireEvent.click(screen.getByLabelText('Show Beta'));
    expect(onVisibilityChange).toHaveBeenCalledWith('b', false);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

describe('LayerList reordering', () => {
  it('reports the new index among the siblings the drag left behind', () => {
    const onReorder = vi.fn();
    list({ onReorder });
    drag('Alpha', 3 * ROW_H + 1);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a'], parentId: null, index: 2 });
  });

  it('drags every selected row, in list order', () => {
    const onReorder = vi.fn();
    list({ onReorder, selectedIds: ['c', 'a'], onSelectionChange: vi.fn() });
    drag('Alpha', 3 * ROW_H + 1);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a', 'c'], parentId: null, index: 1 });
  });

  it('drops just above a fixed row, and never past it', () => {
    const onReorder = vi.fn();
    list({ items: [...FLAT, BG], onReorder });
    drag('Alpha', 4 * ROW_H + 1);
    expect(onReorder).not.toHaveBeenCalled();
    drag('Alpha', 3 * ROW_H - 2);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a'], parentId: null, index: 2 });
  });

  it('never starts a drag from a fixed or a locked row', () => {
    const onReorder = vi.fn();
    list({ items: [{ id: 'a', label: 'Alpha', locked: true }, FLAT[1]!, FLAT[2]!, BG], onReorder });
    drag('Background', 0, 3 * ROW_H + 4);
    drag('Alpha', 3 * ROW_H - 2, 4);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('leaves a locked row behind when it drags the selection holding it', () => {
    const onReorder = vi.fn();
    const items = [{ id: 'a', label: 'Alpha', locked: true }, FLAT[1]!, FLAT[2]!];
    list({ items, onReorder, selectedIds: ['a', 'b'], onSelectionChange: vi.fn() });
    drag('Beta', 3 * ROW_H + 1, ROW_H + 4);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['b'], parentId: null, index: 2 });
  });

  it('does not drag at all without onReorder', () => {
    const onSelectionChange = vi.fn();
    list({ selectedIds: [], onSelectionChange });
    drag('Alpha', 3 * ROW_H + 1);
    click('Alpha');
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a']);
  });

  it('reorders within a subtree, naming its parent', () => {
    const onReorder = vi.fn();
    list({ items: TREE, onReorder });
    drag('One', 3 * ROW_H - 2, ROW_H + 4);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['g1'], parentId: 'g', index: 1 });
  });

  it('drops a row into another layer', () => {
    const onReorder = vi.fn();
    list({ items: TREE, onReorder });
    drag('Beta', ROW_H / 2, 3 * ROW_H + 4);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['b'], parentId: 'g', index: 2 });
  });

  it('drops nothing into a locked layer, or where canMove refuses', () => {
    const onReorder = vi.fn();
    const { rerender } = list({ items: [{ ...TREE[0]!, locked: true }, TREE[1]!], onReorder });
    drag('Beta', ROW_H / 2, 3 * ROW_H + 4);
    const canMove = vi.fn(() => false);
    rerender(<LayerList items={TREE} onReorder={onReorder} canMove={canMove} />);
    drag('Beta', ROW_H / 2, 3 * ROW_H + 4);
    expect(canMove).toHaveBeenCalledWith({ ids: ['b'], parentId: 'g', index: 2 });
    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe('LayerList nesting', () => {
  const twisty = (label: string) => row(label).querySelector<HTMLElement>('[data-tree-twisty]')!;

  it('renders the children of an open layer', () => {
    list({ items: TREE });
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('folds children away on the twisty, and not on a press of the row', () => {
    list({ items: TREE });
    click('Group');
    expect(screen.getByText('One')).toBeInTheDocument();
    fireEvent.click(twisty('Group'));
    expect(screen.queryByText('One')).toBeNull();
  });

  it('starts folded when the layer says so, including one added later', () => {
    const later: LayerListItem = { id: 'h', label: 'Later', defaultCollapsed: true, children: [{ id: 'h1', label: 'Hidden' }] };
    const { rerender } = list({ items: TREE });
    rerender(<LayerList items={[...TREE, later]} />);
    expect(screen.getByText('Later')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('takes folding from collapsedIds and reports the next set', () => {
    const onCollapsedChange = vi.fn();
    list({ items: TREE, collapsedIds: ['g'], onCollapsedChange });
    expect(screen.queryByText('One')).toBeNull();
    fireEvent.click(twisty('Group'));
    expect(onCollapsedChange).toHaveBeenCalledWith([]);
    // Controlled: nothing changes until the prop does.
    expect(screen.queryByText('One')).toBeNull();
  });
});

describe('LayerList controls', () => {
  it('reports visibility from the checkbox, and gives fixed layers none', () => {
    const onVisibilityChange = vi.fn();
    list({ items: [{ id: 'a', label: 'Alpha', visible: false }, BG], onVisibilityChange });
    fireEvent.click(screen.getByLabelText('Show Alpha'));
    expect(onVisibilityChange).toHaveBeenCalledWith('a', true);
    expect(screen.queryByLabelText('Show Background')).toBeNull();
  });

  it('puts the toggles after the label', () => {
    list({ items: [{ id: 'a', label: 'Alpha' }], onLockChange: vi.fn(), onVisibilityChange: vi.fn() });
    for (const name of ['Show Alpha', 'Lock Alpha']) {
      const control = screen.getByLabelText(name);
      expect(screen.getByText('Alpha').compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('reports a lock toggle, gives fixed layers none, and leaves a locked layer hideable', () => {
    const onLockChange = vi.fn();
    const onVisibilityChange = vi.fn();
    list({
      items: [{ id: 'a', label: 'Alpha', locked: true }, { id: 'b', label: 'Beta' }, BG],
      onLockChange, onVisibilityChange, onRemove: vi.fn(),
    });
    expect(screen.getByLabelText('Lock Alpha')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByLabelText('Lock Alpha'));
    fireEvent.click(screen.getByLabelText('Lock Beta'));
    expect(onLockChange.mock.calls).toEqual([['a', false], ['b', true]]);
    expect(screen.queryByLabelText('Lock Background')).toBeNull();
    expect(screen.getByLabelText('Show Alpha')).toBeInTheDocument();
    expect(screen.queryByLabelText('Remove Alpha')).toBeNull();
    expect(screen.getByLabelText('Remove Beta')).toBeInTheDocument();
  });

  it('removes a layer from its ✕, only when onRemove is given', () => {
    const onRemove = vi.fn();
    const { rerender } = list();
    expect(screen.queryByLabelText('Remove Alpha')).toBeNull();
    rerender(<LayerList items={FLAT} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Remove Alpha'));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('adds a kind from the palette, shown only with onAdd', () => {
    const onAdd = vi.fn();
    const { rerender } = list({ title: 'Fill', addKinds: ['shadow'] });
    expect(screen.queryByLabelText('Add shadow')).toBeNull();
    rerender(<LayerList items={FLAT} title="Fill" addKinds={['shadow']} onAdd={onAdd} />);
    fireEvent.click(screen.getByLabelText('Add shadow'));
    expect(onAdd).toHaveBeenCalledWith('shadow');
  });

  it('renders no head without a title or a palette', () => {
    list();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('moveLayers', () => {
  it('moves a block among its siblings', () => {
    expect(moveLayers(FLAT, { ids: ['a', 'c'], parentId: null, index: 1 }).map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });

  it('moves within a subtree and leaves the rest alone', () => {
    const next = moveLayers(TREE, { ids: ['g1'], parentId: 'g', index: 1 });
    expect(next.map((l) => l.id)).toEqual(['g', 'b']);
    expect(next[0]?.children?.map((l) => l.id)).toEqual(['g2', 'g1']);
    expect(next[1]).toBe(TREE[1]);
  });

  it('moves a layer to another parent', () => {
    const next = moveLayers(TREE, { ids: ['b', 'g2'], parentId: 'g', index: 0 });
    expect(next.map((l) => l.id)).toEqual(['g']);
    expect(next[0]?.children?.map((l) => l.id)).toEqual(['b', 'g2', 'g1']);
  });
});
