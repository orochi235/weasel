import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { LayerList, type LayerListItem, type LayerListProps, moveLayers } from './LayerList';

const FLAT: LayerListItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

const TREE: LayerListItem[] = [
  { id: 'g', label: 'Group', children: [{ id: 'g1', label: 'One' }, { id: 'g2', label: 'Two' }] },
  { id: 'b', label: 'Beta' },
];

const ROW_H = 28;
const realRect = Element.prototype.getBoundingClientRect;

// jsdom lays nothing out. Each entry stands `ROW_H` tall at its place among its
// siblings, which is all the drop-index math reads.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (!/_entry_/.test(this.className)) return realRect.call(this);
    const i = Array.from(this.parentElement?.children ?? []).indexOf(this);
    return { x: 0, y: i * ROW_H, top: i * ROW_H, left: 0, right: 200, bottom: (i + 1) * ROW_H, width: 200, height: ROW_H } as DOMRect;
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

function pointer(target: EventTarget, type: string, init: PointerEventInit = {}) {
  act(() => {
    target.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, isPrimary: true, buttons: 1, ...init }));
  });
}

/** Presses `label`'s row, drags it to `toY`, and lets go. */
function drag(label: string, toY: number, fromY = 0) {
  const row = screen.getByText(label);
  fireEvent.pointerDown(row, { pointerId: 1, isPrimary: true, buttons: 1, clientY: fromY });
  pointer(document, 'pointermove', { clientY: toY });
  pointer(document, 'pointerup', { clientY: toY, buttons: 0 });
}

function click(label: string, init: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {}) {
  const row = screen.getByText(label);
  fireEvent.pointerDown(row, { pointerId: 1, isPrimary: true, buttons: 1, clientY: 0, ...init });
  pointer(document, 'pointerup', { clientY: 0, buttons: 0 });
}

function list(props: Partial<LayerListProps> = {}) {
  return renderWithIcons(<LayerList items={FLAT} {...props} />);
}

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

  it('marks fixed rows and gives them a lock instead of a grip', () => {
    const { container } = list({ items: [...FLAT, { id: 'bg', label: 'Background', fixed: true }], onReorder: vi.fn() });
    expect(container.querySelectorAll('[data-fixed="true"]')).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: 'Locked' })).toHaveLength(1);
  });
});

describe('LayerList selection', () => {
  it('selects the clicked row', () => {
    const onSelect = vi.fn();
    list({ selectedIds: [], onSelect });
    click('Beta');
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
  });

  it('selects from the committed props, not an abandoned render\'s', () => {
    const committed = { selectedIds: ['a'], onSelect: vi.fn() };
    const abandoned = { selectedIds: ['c'], onSelect: vi.fn() };
    renderThenAbandon(committed, abandoned, (p) => <LayerList items={FLAT} {...p} />);
    click('Beta', { metaKey: true });
    expect(abandoned.onSelect).not.toHaveBeenCalled();
    expect(committed.onSelect).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('adds and removes a row on Cmd-click and on Ctrl-click', () => {
    const onSelect = vi.fn();
    const { rerender } = list({ selectedIds: ['a'], onSelect });
    click('Gamma', { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['a', 'c']);
    rerender(<LayerList items={FLAT} selectedIds={['a', 'c']} onSelect={onSelect} />);
    click('Alpha', { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['c']);
  });

  it('selects every row from the last click to a shift-click', () => {
    const onSelect = vi.fn();
    const { rerender } = list({ selectedIds: [], onSelect });
    click('Alpha');
    rerender(<LayerList items={FLAT} selectedIds={['a']} onSelect={onSelect} />);
    click('Gamma', { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['a', 'b', 'c']);
  });

  it('ranges over the rows that are showing, not a collapsed branch\'s children', () => {
    const onSelect = vi.fn();
    const { rerender } = list({ items: TREE, collapsedIds: ['g'], selectedIds: [], onSelect });
    click('Group');
    rerender(<LayerList items={TREE} collapsedIds={['g']} selectedIds={['g']} onSelect={onSelect} />);
    click('Beta', { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['g', 'b']);
  });

  it('selects a fixed row alone, even on Cmd-click', () => {
    const onSelect = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', fixed: true }], selectedIds: ['a'], onSelect });
    click('Background', { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['bg']);
  });

  it('drops a fixed row from the selection a Cmd-click builds on', () => {
    const onSelect = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', fixed: true }], selectedIds: ['bg'], onSelect });
    click('Beta', { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
  });

  it('passes over a fixed row inside a shift-click range', () => {
    const onSelect = vi.fn();
    const items = [FLAT[0]!, { id: 'bg', label: 'Background', fixed: true }, FLAT[2]!];
    const { rerender } = list({ items, selectedIds: [], onSelect });
    click('Alpha');
    rerender(<LayerList items={items} selectedIds={['a']} onSelect={onSelect} />);
    click('Gamma', { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('marks the selected row', () => {
    const { container } = list({ selectedIds: ['b'], onSelect: vi.fn() });
    const rows = container.querySelectorAll('[data-selected="true"]');
    expect(Array.from(rows).some((r) => r.textContent === 'Beta')).toBe(true);
  });

  it('does not select a row when a press lands on its checkbox', () => {
    const onSelect = vi.fn();
    list({ selectedIds: [], onSelect, onVisibilityChange: vi.fn() });
    fireEvent.pointerDown(screen.getByLabelText('Show Beta'), { pointerId: 1, isPrimary: true, buttons: 1 });
    pointer(document, 'pointerup', { buttons: 0 });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('LayerList reordering', () => {
  it('reports the new index among the siblings the drag left behind', () => {
    const onReorder = vi.fn();
    list({ onReorder });
    // Alpha to the bottom: past Gamma's bottom edge.
    drag('Alpha', 3 * ROW_H + 1);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a'], parentId: null, index: 2 });
  });

  it('drags every selected sibling, in list order', () => {
    const onReorder = vi.fn();
    list({ onReorder, selectedIds: ['c', 'a'], onSelect: vi.fn() });
    drag('Alpha', 3 * ROW_H + 1);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a', 'c'], parentId: null, index: 1 });
  });

  it('cannot drop at or past a fixed row', () => {
    const onReorder = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', fixed: true }], onReorder });
    drag('Alpha', 1000);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a'], parentId: null, index: 2 });
  });

  it('never starts a drag from a fixed row', () => {
    const onReorder = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', fixed: true }], onReorder });
    drag('Background', 0, 3 * ROW_H);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not drag at all without onReorder', () => {
    const onSelect = vi.fn();
    list({ selectedIds: [], onSelect });
    drag('Alpha', 3 * ROW_H + 1);
    // The press was never a drag, so its release is a click.
    expect(onSelect).toHaveBeenLastCalledWith(['a']);
  });
});

describe('LayerList nesting', () => {
  it('renders the children of an open layer', () => {
    list({ items: TREE });
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('folds children away on the twisty', () => {
    list({ items: TREE });
    fireEvent.click(screen.getByLabelText('Group sublayers'));
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
    fireEvent.click(screen.getByLabelText('Group sublayers'));
    expect(onCollapsedChange).toHaveBeenCalledWith([]);
    // Controlled: nothing changes until the prop does.
    expect(screen.queryByText('One')).toBeNull();
  });

  it('ties the twisty to the subtree it reveals', () => {
    list({ items: TREE });
    const twisty = screen.getByLabelText('Group sublayers');
    const id = twisty.getAttribute('aria-controls');
    expect(id && document.getElementById(id)?.textContent).toContain('One');
  });

  it('spends no twisty column on a flat list', () => {
    list();
    expect(screen.queryByLabelText(/sublayers$/)).toBeNull();
  });

  it('reorders within a subtree, naming its parent', () => {
    const onReorder = vi.fn();
    list({ items: TREE, onReorder });
    drag('One', 2 * ROW_H + 1);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['g1'], parentId: 'g', index: 1 });
  });
});

describe('LayerList cards', () => {
  const body = (item: LayerListItem) => <div data-testid={`body-${item.id}`}>body of {item.id}</div>;

  it('draws a layer with a body as a card with a handle', () => {
    list({ renderBody: body, onReorder: vi.fn() });
    expect(screen.getByTestId('body-a')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /^Drag to reorder/ })).toHaveLength(3);
  });

  it('leaves a layer whose body is null a row', () => {
    list({ renderBody: (item) => (item.id === 'a' ? body(item) : null), onReorder: vi.fn() });
    expect(screen.getAllByRole('button', { name: /^Drag to reorder/ })).toHaveLength(1);
  });

  it('folds a card body away without unmounting it', () => {
    list({ items: [{ id: 'a', label: 'Alpha', defaultCollapsed: true }], renderBody: body });
    expect(screen.getByTestId('body-a')).not.toBeVisible();
  });

  it('puts the title in the header in place of the label', () => {
    list({ items: [{ id: 'a', label: 'Alpha', title: <em>fancy</em> }], renderBody: body });
    expect(screen.getByText('fancy')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('reorders cards from the handle', () => {
    const onReorder = vi.fn();
    list({ renderBody: body, onReorder });
    const handle = screen.getByRole('button', { name: 'Drag to reorder Alpha' });
    fireEvent.pointerDown(handle, { pointerId: 1, isPrimary: true, buttons: 1, clientY: 0 });
    pointer(document, 'pointermove', { clientY: 2 * ROW_H + 1 });
    pointer(document, 'pointerup', { clientY: 2 * ROW_H + 1, buttons: 0 });
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a'], parentId: null, index: 1 });
  });
});

describe('LayerList controls', () => {
  it('reports visibility from the checkbox, and gives fixed layers none', () => {
    const onVisibilityChange = vi.fn();
    list({ items: [{ id: 'a', label: 'Alpha', visible: false }, { id: 'bg', label: 'Background', fixed: true }], onVisibilityChange });
    fireEvent.click(screen.getByLabelText('Show Alpha'));
    expect(onVisibilityChange).toHaveBeenCalledWith('a', true);
    expect(screen.queryByLabelText('Show Background')).toBeNull();
  });

  it('puts the lock toggle after the label', () => {
    list({ items: [{ id: 'a', label: 'Alpha' }], onLockChange: vi.fn(), onVisibilityChange: vi.fn() });
    const lock = screen.getByLabelText('Lock Alpha');
    expect(screen.getByText('Alpha').compareDocumentPosition(lock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reports a lock toggle, gives fixed layers none, and leaves a locked layer hideable', () => {
    const onLockChange = vi.fn();
    const onVisibilityChange = vi.fn();
    list({
      items: [{ id: 'a', label: 'Alpha', locked: true }, { id: 'b', label: 'Beta' }, { id: 'bg', label: 'Background', fixed: true }],
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

  it('renames a row from a double-click on its label, committing on Enter', () => {
    const onRename = vi.fn();
    list({ onRename });
    fireEvent.doubleClick(screen.getByText('Alpha'));
    const field = screen.getByLabelText('Rename Alpha');
    fireEvent.change(field, { target: { value: 'First' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('a', 'First');
    expect(screen.queryByLabelText('Rename Alpha')).toBeNull();
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
    list({ onRename });
    const row = screen.getByText('Beta').closest('[role="row"]')!;
    fireEvent.keyDown(row, { key: 'F2' });
    const field = screen.getByLabelText('Rename Beta');
    fireEvent.change(field, { target: { value: 'Second' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByLabelText('Rename Beta')).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
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
      expect(screen.queryByLabelText(`Rename ${label}`)).toBeNull();
    }
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

describe('LayerList keyboard', () => {
  const row = (label: string) => screen.getByText(label).closest('[role="row"]') as HTMLElement;

  it('is a treegrid with one row in the tab order', () => {
    list({ items: TREE, selectedIds: ['b'], onSelect: vi.fn() });
    expect(screen.getByRole('treegrid', { name: 'Layers' })).toBeInTheDocument();
    const tabbable = screen.getAllByRole('row').filter((r) => r.tabIndex === 0);
    expect(tabbable.map((r) => r.textContent)).toEqual(['Beta']);
    expect(row('Group').getAttribute('aria-expanded')).toBe('true');
    expect(row('One').getAttribute('aria-level')).toBe('2');
  });

  it('puts each row\'s content in a gridcell, which a row must own', () => {
    list({ onRemove: () => {} });
    for (const row of screen.getAllByRole('row')) {
      const cells = Array.from(row.children).filter((c) => c.getAttribute('role') === 'gridcell');
      expect(cells).toHaveLength(row.children.length);
      expect(cells.length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Alpha').closest('[role="gridcell"]')).not.toBeNull();
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
    const onSelect = vi.fn();
    list({ selectedIds: ['a'], onSelect });
    fireEvent.keyDown(row('Beta'), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
    fireEvent.keyDown(row('Gamma'), { key: ' ', metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('selects a range with Shift+arrows, passing over a fixed row', () => {
    const onSelect = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', fixed: true }], selectedIds: [], onSelect });
    act(() => row('Beta').focus());
    fireEvent.keyDown(row('Beta'), { key: 'ArrowDown', shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b', 'c']);
    fireEvent.keyDown(row('Gamma'), { key: 'End', shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b', 'c']);
  });

  it('selects the row Shift+arrow reaches when the anchor is hidden in a collapsed branch', () => {
    const onSelect = vi.fn();
    list({ items: TREE, selectedIds: [], onSelect });
    act(() => row('One').focus());
    fireEvent.keyDown(row('Group'), { key: 'ArrowLeft' });
    expect(screen.queryByText('One')).toBeNull();
    fireEvent.keyDown(row('Group'), { key: 'ArrowDown', shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
  });

  it('moves a row with Alt+arrows, as a drag of it would', () => {
    const onReorder = vi.fn();
    list({ onReorder });
    fireEvent.keyDown(row('Alpha'), { key: 'ArrowDown', altKey: true });
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a'], parentId: null, index: 1 });
  });

  it('moves a child among its siblings with Alt+arrows', () => {
    const onReorder = vi.fn();
    list({ items: TREE, onReorder });
    fireEvent.keyDown(row('Two'), { key: 'ArrowUp', altKey: true });
    expect(onReorder).toHaveBeenCalledWith({ ids: ['g2'], parentId: 'g', index: 0 });
  });

  it('moves a card with Alt+arrows on its handle', () => {
    const onReorder = vi.fn();
    list({ onReorder, renderBody: (item) => <div>body of {item.id}</div> });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Drag to reorder Beta' }), { key: 'ArrowUp', altKey: true });
    expect(onReorder).toHaveBeenCalledWith({ ids: ['b'], parentId: null, index: 0 });
  });

  it('leaves keys on a control inside a row to the control', () => {
    const onSelect = vi.fn();
    list({ selectedIds: [], onSelect, onVisibilityChange: vi.fn() });
    fireEvent.keyDown(screen.getByLabelText('Show Beta'), { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
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
});
