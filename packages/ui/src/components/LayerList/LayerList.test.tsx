import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function click(label: string, init: { shiftKey?: boolean } = {}) {
  const row = screen.getByText(label);
  fireEvent.pointerDown(row, { pointerId: 1, isPrimary: true, buttons: 1, clientY: 0, ...init });
  pointer(document, 'pointerup', { clientY: 0, buttons: 0 });
}

function list(props: Partial<LayerListProps> = {}) {
  return render(<LayerList items={FLAT} {...props} />);
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
    expect(screen.getByTestId('swatch')).toBeInTheDocument();
  });

  it('appends className to the root, keeping its own class', () => {
    const { container } = list({ className: 'host' });
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains('host')).toBe(true);
    expect(root.classList.length).toBeGreaterThan(1);
  });

  it('marks locked rows and gives them a lock instead of a grip', () => {
    const { container } = list({ items: [...FLAT, { id: 'bg', label: 'Background', locked: true }], onReorder: vi.fn() });
    expect(container.querySelectorAll('[data-locked="true"]')).toHaveLength(1);
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

  it('adds and removes a row on shift-click', () => {
    const onSelect = vi.fn();
    const { rerender } = list({ selectedIds: ['a'], onSelect });
    click('Beta', { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['a', 'b']);
    rerender(<LayerList items={FLAT} selectedIds={['a', 'b']} onSelect={onSelect} />);
    click('Alpha', { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
  });

  it('selects a locked row alone, even on shift-click', () => {
    const onSelect = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', locked: true }], selectedIds: ['a'], onSelect });
    click('Background', { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['bg']);
  });

  it('drops a locked row from the selection a shift-click builds on', () => {
    const onSelect = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', locked: true }], selectedIds: ['bg'], onSelect });
    click('Beta', { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
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

  it('cannot drop at or past a locked row', () => {
    const onReorder = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', locked: true }], onReorder });
    drag('Alpha', 1000);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['a'], parentId: null, index: 2 });
  });

  it('never starts a drag from a locked row', () => {
    const onReorder = vi.fn();
    list({ items: [...FLAT, { id: 'bg', label: 'Background', locked: true }], onReorder });
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
  it('reports visibility from the checkbox, and gives locked layers none', () => {
    const onVisibilityChange = vi.fn();
    list({ items: [{ id: 'a', label: 'Alpha', visible: false }, { id: 'bg', label: 'Background', locked: true }], onVisibilityChange });
    fireEvent.click(screen.getByLabelText('Show Alpha'));
    expect(onVisibilityChange).toHaveBeenCalledWith('a', true);
    expect(screen.queryByLabelText('Show Background')).toBeNull();
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
});
