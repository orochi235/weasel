import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { FocusRow } from './useRemovedRowFocus';
import { useRowNavigation, type RowNavigationOptions } from './useRowNavigation';

afterEach(() => { cleanup(); });

type Opts = Omit<RowNavigationOptions<HTMLDivElement>, 'rows'>;

function List({ rows, opts = {} }: { rows: readonly FocusRow[]; opts?: Opts }) {
  const nav = useRowNavigation<HTMLDivElement>({ rows, ...opts });
  return (
    <div role="listbox">
      {rows.map((r) => (
        <div
          key={r.id}
          role="option"
          aria-selected={false}
          ref={nav.rowRef(r.id)}
          tabIndex={nav.tabStop === r.id ? 0 : -1}
          onFocus={() => nav.onFocus(r.id)}
          onKeyDown={(e) => nav.onKeyDown(r.id, e)}
        >
          {r.id}
          <button type="button" onClick={() => opts.onActivate?.(`remove ${r.id}`, { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false })}>x</button>
        </div>
      ))}
    </div>
  );
}

const FLAT = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
const row = (id: string) => screen.getByRole('option', { name: new RegExp(`^${id} x$`) });
const key = (k: string, init: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.activeElement!, { key: k, ...init });
const stops = () => screen.getAllByRole('option').filter((el) => el.tabIndex === 0).map((el) => el.firstChild?.textContent);

describe('useRowNavigation', () => {
  it('puts the first selected row in the tab order, then the row last focused', () => {
    render(<List rows={FLAT} opts={{ isSelected: (id) => id === 'c' }} />);
    expect(stops()).toEqual(['c']);
    act(() => row('b').focus());
    expect(stops()).toEqual(['b']);
  });

  it('walks Up, Down, Home, and End, clamped at the ends', () => {
    render(<List rows={FLAT} />);
    act(() => row('a').focus());
    key('ArrowUp');
    expect(document.activeElement).toBe(row('a'));
    key('ArrowDown');
    expect(document.activeElement).toBe(row('b'));
    key('End');
    key('ArrowDown');
    expect(document.activeElement).toBe(row('d'));
    key('Home');
    expect(document.activeElement).toBe(row('a'));
  });

  it('extends from the anchor with Shift, and re-anchors on a plain move', () => {
    const onExtend = vi.fn();
    let anchor: string | null = null;
    function Probe() {
      const nav = useRowNavigation<HTMLDivElement>({ rows: FLAT, onExtend: (to, from) => { anchor = nav.anchor.current; onExtend(to, from); } });
      return FLAT.map((r) => (
        <div key={r.id} role="option" aria-selected={false} ref={nav.rowRef(r.id)} tabIndex={-1} onFocus={() => nav.onFocus(r.id)} onKeyDown={(e) => nav.onKeyDown(r.id, e)}>{r.id}<button type="button">x</button></div>
      ));
    }
    render(<Probe />);
    act(() => row('a').focus());
    key('ArrowDown');
    key('ArrowDown', { shiftKey: true });
    expect(onExtend).toHaveBeenLastCalledWith('c', 'b');
    expect(anchor).toBe('b');
    expect(document.activeElement).toBe(row('c'));
  });

  it('nudges with Alt+Up/Down and keeps focus on the moved row', () => {
    function Nudged() {
      const [rows, setRows] = useState(FLAT);
      return <List rows={rows} opts={{ onNudge: (id, delta) => {
        const at = rows.findIndex((r) => r.id === id);
        const next = [...rows];
        next.splice(at, 1);
        next.splice(at + delta, 0, rows[at]!);
        setRows(next);
      } }} />;
    }
    render(<Nudged />);
    act(() => row('a').focus());
    key('ArrowDown', { altKey: true });
    expect(screen.getAllByRole('option').map((el) => el.firstChild?.textContent)).toEqual(['b', 'a', 'c', 'd']);
    expect(document.activeElement).toBe(row('a'));
  });

  it('moves focus with Alt+arrows where there is nothing to nudge, and with Cmd+Alt', () => {
    const onNudge = vi.fn();
    const { unmount } = render(<List rows={FLAT} />);
    act(() => row('a').focus());
    key('ArrowDown', { altKey: true });
    expect(document.activeElement).toBe(row('b'));
    unmount();
    render(<List rows={FLAT} opts={{ onNudge }} />);
    act(() => row('a').focus());
    key('ArrowDown', { altKey: true, metaKey: true });
    expect(onNudge).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(row('b'));
  });

  it('drops a nudge the consumer never draws instead of pulling focus on a later render', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    try {
      function Later() {
        const [, bump] = useState(0);
        return (
          <>
            <button type="button" onClick={() => bump((n) => n + 1)}>render</button>
            <List rows={FLAT} opts={{ onNudge: () => true }} />
          </>
        );
      }
      render(<Later />);
      act(() => row('b').focus());
      key('ArrowDown', { altKey: true });
      act(() => screen.getByRole('button', { name: 'render' }).focus());
      act(() => { vi.advanceTimersToNextFrame(); });
      fireEvent.click(screen.getByRole('button', { name: 'render' }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'render' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens, enters, closes, and leaves a branch with Right and Left', () => {
    function Folding() {
      const [open, setOpen] = useState(false);
      const rows = open ? [{ id: 'g' }, { id: 'g1', parentId: 'g' }, { id: 'z' }] : [{ id: 'g' }, { id: 'z' }];
      return <List rows={rows} opts={{ tree: {
        isBranch: (id) => id === 'g', isOpen: (id) => id === 'g' && open, toggle: () => { setOpen((o) => !o); return true; },
      } }} />;
    }
    render(<Folding />);
    act(() => row('g').focus());
    key('ArrowRight');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    key('ArrowRight');
    expect(document.activeElement).toBe(row('g1'));
    key('ArrowLeft');
    expect(document.activeElement).toBe(row('g'));
    key('ArrowLeft');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('types ahead to the next row whose text matches, only when asked', () => {
    const rows = ['apple', 'avocado', 'banana'].map((id) => ({ id }));
    const { unmount } = render(<List rows={rows} />);
    act(() => row('apple').focus());
    key('b');
    expect(document.activeElement).toBe(row('apple'));
    unmount();
    render(<List rows={rows} opts={{ textOf: (id) => id }} />);
    act(() => row('apple').focus());
    key('b');
    expect(document.activeElement).toBe(row('banana'));
  });

  it('cycles through the rows a repeated letter starts, and builds a prefix from different letters', () => {
    const rows = ['apple', 'avocado', 'banana', 'apricot'].map((id) => ({ id }));
    render(<List rows={rows} opts={{ textOf: (id) => id }} />);
    act(() => row('banana').focus());
    key('a');
    expect(document.activeElement).toBe(row('apricot'));
    key('a');
    expect(document.activeElement).toBe(row('apple'));
    key('a');
    expect(document.activeElement).toBe(row('avocado'));
    key('p');
    expect(document.activeElement).toBe(row('apricot'));
  });

  it('activates with Enter and Space, carrying the modifiers', () => {
    const onActivate = vi.fn();
    render(<List rows={FLAT} opts={{ onActivate }} />);
    act(() => row('b').focus());
    key(' ', { shiftKey: true });
    expect(onActivate).toHaveBeenCalledWith('b', expect.objectContaining({ shiftKey: true }));
  });

  it('hands focus to the next sibling when the focused row is removed', () => {
    function Removable() {
      const [rows, setRows] = useState(FLAT);
      return <List rows={rows} opts={{ onActivate: (what) => setRows(rows.filter((r) => `remove ${r.id}` !== what)) }} />;
    }
    render(<Removable />);
    const x = row('b').querySelector('button')!;
    act(() => x.focus());
    fireEvent.click(x);
    expect(document.activeElement).toBe(row('c'));
  });
});
