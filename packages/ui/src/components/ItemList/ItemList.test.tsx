import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ItemList } from './ItemList';

afterEach(() => { cleanup(); });

describe('ItemList', () => {
  it('renders a row per item, in order', () => {
    render(<ItemList rows={[{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }]} />);
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('shows the empty slot instead of rows when there are none', () => {
    render(<ItemList rows={[]} empty="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('draws the ghost rows at its point, in the nearest themed host, hidden from assistive tech', () => {
    render(
      <div data-wzl-theme="t" data-testid="host">
        <ItemList
          rows={[{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }, { id: 'c', label: 'Three' }]}
          ghost={{ ids: ['a', 'c'], left: 40, top: 70, width: 180 }}
        />
      </div>,
    );
    const ghost = screen.getByTestId('host').querySelector(':scope > [aria-hidden="true"]') as HTMLElement;
    expect(ghost).not.toBeNull();
    expect(ghost.textContent).toBe('OneThree');
    expect(ghost.style.left).toBe('40px');
    expect(ghost.style.top).toBe('70px');
    expect(ghost.style.width).toBe('180px');
  });

  it('falls back to a dash when nothing is given for empty', () => {
    render(<ItemList rows={[]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('puts leading content before the label', () => {
    render(<ItemList rows={[{
      id: 'a', label: 'Layer', leading: <span data-testid="swatch" />,
    }]} />);
    const swatch = screen.getByTestId('swatch');
    const label = screen.getByText('Layer');
    // `compareDocumentPosition` returns FOLLOWING when the argument comes after.
    expect(swatch.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('spreads a row\'s own props onto its element', () => {
    const onClick = vi.fn();
    render(<ItemList rows={[{
      id: 'a', label: 'Row', rowProps: { onClick, 'data-row-index': 3 },
    }]} />);
    const row = screen.getByText('Row').parentElement!;
    expect(row).toHaveAttribute('data-row-index', '3');
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the overlay inside the container, before the rows', () => {
    render(<ItemList
      rows={[{ id: 'a', label: 'Row' }]}
      overlay={<div data-testid="drop" />}
    />);
    expect(screen.getByTestId('drop')).toBeInTheDocument();
  });

  it('drops the overlay when there are no rows — there is nothing to drop onto', () => {
    render(<ItemList rows={[]} overlay={<div data-testid="drop" />} />);
    expect(screen.queryByTestId('drop')).toBeNull();
  });

  describe('drop indicator', () => {
    const css = readFileSync(resolve(__dirname, 'ItemList.module.css'), 'utf8');
    const ROWS = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
    const rowOf = (label: string) => screen.getByText(label).parentElement!;
    const marks = () => ['A', 'B', 'C'].map((l) => rowOf(l).getAttribute('data-drop'));

    it('marks no row while there is no drop index', () => {
      render(<ItemList rows={ROWS} dropIndex={null} />);
      expect(marks()).toEqual([null, null, null]);
    });

    it('marks the seam above the row at the index', () => {
      render(<ItemList rows={ROWS} dropIndex={1} />);
      expect(marks()).toEqual([null, 'before', null]);
    });

    it('marks the top of the list at 0', () => {
      render(<ItemList rows={ROWS} dropIndex={0} />);
      expect(marks()).toEqual(['before', null, null]);
    });

    it('marks the seam below the last row at rows.length', () => {
      render(<ItemList rows={ROWS} dropIndex={3} />);
      expect(marks()).toEqual([null, null, 'after']);
    });

    it('adds no element to the list, so a drag measuring its rows needs no selector', () => {
      const { container } = render(<ItemList rows={ROWS} dropIndex={1} />);
      expect(container.firstElementChild!.children).toHaveLength(3);
    });

    it('draws the seam from the row itself, with no measured offset', () => {
      expect(css).toMatch(/\.row\[data-drop='before'\]\s*\{[^}]*box-shadow:[^;]*var\(--wzl-accent\)/);
      expect(css).toMatch(/\.row\[data-drop='after'\]\s*\{[^}]*box-shadow:[^;]*var\(--wzl-accent\)/);
    });

    it("dims a row that is being dragged", () => {
      render(<ItemList rows={[{ id: 'a', label: 'A', dragging: true }, { id: 'b', label: 'B' }]} />);
      expect(rowOf('A').getAttribute('data-dragging')).toBe('true');
      expect(rowOf('B').getAttribute('data-dragging')).toBeNull();
      expect(css).toMatch(/\.row\[data-dragging\]\s*\{[^}]*opacity/);
    });
  });

  describe('semantics', () => {
    const ROWS = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', selected: true },
      { id: 'c', label: 'C' },
    ];

    it('is a plain list with nothing to select or activate, and puts no row in the tab order', () => {
      render(<ItemList rows={ROWS} />);
      expect(screen.getByRole('list')).toBeInTheDocument();
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
      for (const it of items) expect(it).not.toHaveAttribute('tabindex');
      expect(items[1]).not.toHaveAttribute('aria-selected');
    });

    it('is a single-select listbox of options with selection="single"', () => {
      render(<ItemList rows={ROWS} selection="single" containerProps={{ 'aria-label': 'Layers' }} />);
      const box = screen.getByRole('listbox', { name: 'Layers' });
      expect(box).not.toHaveAttribute('aria-multiselectable');
      const opts = screen.getAllByRole('option');
      expect(opts.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    });

    it('marks a multi-select listbox', () => {
      render(<ItemList rows={ROWS} selection="multi" />);
      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    });

    it('becomes a grid when rows carry controls, so the controls are not inside an option', () => {
      render(<ItemList
        selection="multi"
        rows={ROWS.map((r) => ({ ...r, trailing: <button type="button">Hide {r.id}</button> }))}
      />);
      expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
      const rows = screen.getAllByRole('row');
      expect(rows.map((r) => r.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
      expect(screen.queryByRole('option')).toBeNull();
      const cells = screen.getAllByRole('gridcell');
      expect(cells).toHaveLength(6);
      expect(cells[1]).toContainElement(screen.getByRole('button', { name: 'Hide a' }));
    });

    it('is a grid with no selection state for an activate-only list', () => {
      render(<ItemList rows={ROWS} onActivate={() => {}} />);
      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(screen.getAllByRole('row')[0]).not.toHaveAttribute('aria-selected');
    });
  });

  describe('keyboard', () => {
    const ROWS = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', selected: true },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ];
    const opt = (label: string) => screen.getByRole('option', { name: label });

    it('puts one row in the tab order: the selected one', () => {
      render(<ItemList rows={ROWS} selection="single" />);
      expect(screen.getAllByRole('option').map((o) => o.tabIndex)).toEqual([-1, 0, -1, -1]);
    });

    it('falls back to the first row when nothing is selected', () => {
      render(<ItemList rows={ROWS.map((r) => ({ ...r, selected: false }))} selection="single" />);
      expect(opt('A').tabIndex).toBe(0);
    });

    it('moves focus with the arrows and stops at the ends', () => {
      render(<ItemList rows={ROWS} selection="single" />);
      opt('B').focus();
      fireEvent.keyDown(opt('B'), { key: 'ArrowDown' });
      expect(opt('C')).toHaveFocus();
      fireEvent.keyDown(opt('C'), { key: 'ArrowUp' });
      fireEvent.keyDown(opt('B'), { key: 'ArrowUp' });
      expect(opt('A')).toHaveFocus();
      fireEvent.keyDown(opt('A'), { key: 'ArrowUp' });
      expect(opt('A')).toHaveFocus();
    });

    it('goes to either end with Home and End', () => {
      render(<ItemList rows={ROWS} selection="single" />);
      opt('B').focus();
      fireEvent.keyDown(opt('B'), { key: 'End' });
      expect(opt('D')).toHaveFocus();
      fireEvent.keyDown(opt('D'), { key: 'Home' });
      expect(opt('A')).toHaveFocus();
    });

    it('keeps the tab stop on the row that last had focus', () => {
      render(<ItemList rows={ROWS} selection="single" />);
      act(() => { opt('D').focus(); });
      expect(opt('D').tabIndex).toBe(0);
      expect(opt('B').tabIndex).toBe(-1);
    });

    it('activates with Enter and Space, passing the modifiers a click would', () => {
      const onActivate = vi.fn();
      render(<ItemList rows={ROWS} selection="multi" onActivate={onActivate} />);
      fireEvent.keyDown(opt('C'), { key: 'Enter' });
      fireEvent.keyDown(opt('C'), { key: ' ', shiftKey: true });
      expect(onActivate).toHaveBeenNthCalledWith(1, 'c', 2, expect.objectContaining({ shiftKey: false }));
      expect(onActivate).toHaveBeenNthCalledWith(2, 'c', 2, expect.objectContaining({ shiftKey: true }));
    });

    it('activates on click, with modifiers', () => {
      const onActivate = vi.fn();
      render(<ItemList rows={ROWS} selection="multi" onActivate={onActivate} />);
      fireEvent.click(opt('A'), { metaKey: true });
      expect(onActivate).toHaveBeenCalledWith('a', 0, expect.objectContaining({ metaKey: true }));
    });

    it('nudges the row with Alt+Arrow and keeps focus on it', () => {
      const onNudge = vi.fn();
      render(<ItemList rows={ROWS} selection="single" onNudge={onNudge} />);
      opt('B').focus();
      fireEvent.keyDown(opt('B'), { key: 'ArrowDown', altKey: true });
      expect(onNudge).toHaveBeenCalledWith('b', 1, 1);
      expect(opt('B')).toHaveFocus();
    });

    it('refocuses a nudged row after the list reorders around it', () => {
      const { rerender } = render(<ItemList rows={ROWS} selection="single" onNudge={() => {}} />);
      opt('B').focus();
      fireEvent.keyDown(opt('B'), { key: 'ArrowUp', altKey: true });
      (document.activeElement as HTMLElement).blur();
      const [a, b, ...rest] = ROWS;
      rerender(<ItemList rows={[b!, a!, ...rest]} selection="single" onNudge={() => {}} />);
      expect(opt('B')).toHaveFocus();
    });

    it('lets a consumer key handler claim a key first', () => {
      const onActivate = vi.fn();
      render(<ItemList
        selection="single"
        onActivate={onActivate}
        rows={[{ id: 'a', label: 'A', rowProps: { onKeyDown: (e) => e.preventDefault() } }]}
      />);
      fireEvent.keyDown(opt('A'), { key: 'Enter' });
      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  describe('row controls', () => {
    const rows = (onToggle: (id: string) => void) => ['a', 'b'].map((id) => ({
      id,
      label: id.toUpperCase(),
      trailing: (
        <>
          <button type="button" onClick={() => onToggle(`${id}-eye`)}>eye {id}</button>
          <button type="button" onClick={() => onToggle(`${id}-lock`)}>lock {id}</button>
        </>
      ),
    }));
    const cell = (label: string) => screen.getByText(label).closest('[role="gridcell"]') as HTMLElement;
    const btn = (name: string) => screen.getByRole('button', { name });

    it('focuses the label cell, and keeps the controls out of the tab order', () => {
      render(<ItemList selection="single" rows={rows(() => {})} />);
      expect(cell('A').tabIndex).toBe(0);
      expect(btn('eye a').tabIndex).toBe(-1);
      expect(btn('lock b').tabIndex).toBe(-1);
    });

    it('runs a control without activating its row', () => {
      const onToggle = vi.fn();
      const onActivate = vi.fn();
      render(<ItemList selection="single" onActivate={onActivate} rows={rows(onToggle)} />);
      fireEvent.click(btn('eye b'));
      expect(onToggle).toHaveBeenCalledWith('b-eye');
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('leaves Enter and Space on a control to the control', () => {
      const onActivate = vi.fn();
      render(<ItemList selection="single" onActivate={onActivate} rows={rows(() => {})} />);
      const ev = fireEvent.keyDown(btn('eye a'), { key: 'Enter' });
      expect(ev).toBe(true);
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('walks into and across the controls with the arrows, and back out', () => {
      render(<ItemList selection="single" rows={rows(() => {})} />);
      cell('A').focus();
      fireEvent.keyDown(cell('A'), { key: 'ArrowRight' });
      expect(btn('eye a')).toHaveFocus();
      fireEvent.keyDown(btn('eye a'), { key: 'ArrowRight' });
      expect(btn('lock a')).toHaveFocus();
      fireEvent.keyDown(btn('lock a'), { key: 'ArrowLeft' });
      fireEvent.keyDown(btn('eye a'), { key: 'ArrowLeft' });
      expect(cell('A')).toHaveFocus();
      fireEvent.keyDown(cell('A'), { key: 'ArrowRight' });
      fireEvent.keyDown(btn('eye a'), { key: 'Escape' });
      expect(cell('A')).toHaveFocus();
    });

    it('moves between rows from a control too', () => {
      render(<ItemList selection="single" rows={rows(() => {})} />);
      btn('eye a').focus();
      fireEvent.keyDown(btn('eye a'), { key: 'ArrowDown' });
      expect(cell('B')).toHaveFocus();
    });
  });
});


describe('ItemList keyboard range selection', () => {
  const ROWS = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id.toUpperCase() }));
  const opt = (label: string) => screen.getByRole('option', { name: label });
  const setup = () => {
    const onSelectRange = vi.fn();
    const onActivate = vi.fn();
    render(<ItemList rows={ROWS} selection="multi" onActivate={onActivate} onSelectRange={onSelectRange} />);
    return { onSelectRange, onActivate };
  };

  it('extends a range from the focused row with Shift+Arrow, moving focus', () => {
    const { onSelectRange, onActivate } = setup();
    act(() => { opt('B').focus(); });
    fireEvent.keyDown(opt('B'), { key: 'ArrowDown', shiftKey: true });
    expect(opt('C')).toHaveFocus();
    expect(onSelectRange).toHaveBeenLastCalledWith(['b', 'c']);
    fireEvent.keyDown(opt('C'), { key: 'ArrowDown', shiftKey: true });
    expect(onSelectRange).toHaveBeenLastCalledWith(['b', 'c', 'd']);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('shrinks and then crosses the anchor, keeping list order', () => {
    const { onSelectRange } = setup();
    act(() => { opt('C').focus(); });
    fireEvent.keyDown(opt('C'), { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(opt('D'), { key: 'ArrowUp', shiftKey: true });
    expect(onSelectRange).toHaveBeenLastCalledWith(['c']);
    fireEvent.keyDown(opt('C'), { key: 'ArrowUp', shiftKey: true });
    expect(onSelectRange).toHaveBeenLastCalledWith(['b', 'c']);
  });

  it('runs to either end with Shift+Home and Shift+End', () => {
    const { onSelectRange } = setup();
    act(() => { opt('C').focus(); });
    fireEvent.keyDown(opt('C'), { key: 'End', shiftKey: true });
    expect(opt('E')).toHaveFocus();
    expect(onSelectRange).toHaveBeenLastCalledWith(['c', 'd', 'e']);
    fireEvent.keyDown(opt('E'), { key: 'Home', shiftKey: true });
    expect(onSelectRange).toHaveBeenLastCalledWith(['a', 'b', 'c']);
  });

  it('anchors on the row last activated, so Shift+click then Shift+Arrow extends from it', () => {
    const { onSelectRange } = setup();
    fireEvent.click(opt('D'), { shiftKey: true });
    act(() => { opt('D').focus(); });
    fireEvent.keyDown(opt('D'), { key: 'ArrowUp', shiftKey: true });
    expect(onSelectRange).toHaveBeenLastCalledWith(['c', 'd']);
  });

  it('re-anchors on a plain move, starting the next range where focus is', () => {
    const { onSelectRange } = setup();
    act(() => { opt('A').focus(); });
    fireEvent.keyDown(opt('A'), { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(opt('B'), { key: 'ArrowDown' });
    fireEvent.keyDown(opt('C'), { key: 'ArrowDown', shiftKey: true });
    expect(onSelectRange).toHaveBeenLastCalledWith(['c', 'd']);
  });

  it('only moves focus on Shift+Arrow without onSelectRange', () => {
    const onActivate = vi.fn();
    render(<ItemList rows={ROWS} selection="multi" onActivate={onActivate} />);
    act(() => { opt('A').focus(); });
    fireEvent.keyDown(opt('A'), { key: 'ArrowDown', shiftKey: true });
    expect(opt('B')).toHaveFocus();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('extends no range in a single-select list', () => {
    const onSelectRange = vi.fn();
    render(<ItemList rows={ROWS} selection="single" onSelectRange={onSelectRange} />);
    act(() => { opt('A').focus(); });
    fireEvent.keyDown(opt('A'), { key: 'ArrowDown', shiftKey: true });
    expect(opt('B')).toHaveFocus();
    expect(onSelectRange).not.toHaveBeenCalled();
  });
});

describe('ItemList range anchor', () => {
  it('re-anchors on a row focused by the pointer', () => {
    const onSelectRange = vi.fn();
    const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id.toUpperCase() }));
    render(<ItemList rows={rows} selection="multi" onSelectRange={onSelectRange} />);
    const opt = (label: string) => screen.getByRole('option', { name: label });
    act(() => { opt('A').focus(); });
    fireEvent.keyDown(opt('A'), { key: 'ArrowDown', shiftKey: true });
    act(() => { opt('D').focus(); });
    fireEvent.keyDown(opt('D'), { key: 'ArrowUp', shiftKey: true });
    expect(onSelectRange).toHaveBeenLastCalledWith(['c', 'd']);
  });
});
