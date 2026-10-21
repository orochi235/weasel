import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { rovingGridTarget, useRovingTabIndex, type UseRovingTabIndexOptions } from './useRovingTabIndex';

type BarProps = UseRovingTabIndexOptions & {
  items?: readonly { label: string; disabled?: boolean; ariaDisabled?: boolean }[];
};

function Bar({ items: list = items, ...options }: BarProps) {
  const roving = useRovingTabIndex(options);
  return (
    <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} role="toolbar">
      {list.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          aria-disabled={item.ariaDisabled ? 'true' : undefined}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const items = [{ label: 'a' }, { label: 'b' }, { label: 'c' }];

function renderBar(props: BarProps = {}) {
  const view = render(<Bar {...props} />);
  const segs = view.container.querySelectorAll<HTMLButtonElement>('button');
  return Object.assign(segs, { view });
}

const tabIndexes = (segs: ArrayLike<HTMLElement>) => Array.from(segs, (b) => b.tabIndex);

function press(el: HTMLElement, key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
}

describe('useRovingTabIndex — tab stop', () => {
  it('puts the first enabled item in the tab order and nothing else', () => {
    expect(tabIndexes(renderBar())).toEqual([0, -1, -1]);
  });

  it('skips a disabled first item', () => {
    const segs = renderBar({ items: [{ label: 'a', disabled: true }, { label: 'b' }, { label: 'c' }] });
    expect(tabIndexes(segs)).toEqual([-1, 0, -1]);
  });

  it('honors an explicit tabStopIndex', () => {
    expect(tabIndexes(renderBar({ tabStopIndex: 2 }))).toEqual([-1, -1, 0]);
  });

  it('falls back to the first enabled item when tabStopIndex is disabled', () => {
    const segs = renderBar({ tabStopIndex: 2, items: [{ label: 'a' }, { label: 'b' }, { label: 'c', disabled: true }] });
    expect(tabIndexes(segs)).toEqual([0, -1, -1]);
  });

  it('leaves the bar out of the tab order when every item is disabled', () => {
    const segs = renderBar({ items: items.map((it) => ({ ...it, disabled: true })) });
    expect(tabIndexes(segs)).toEqual([-1, -1, -1]);
  });

  it('follows focus, so a clicked or focused item keeps the stop after focus leaves', () => {
    const segs = renderBar();
    act(() => segs[2].focus());
    expect(tabIndexes(segs)).toEqual([-1, -1, 0]);
    act(() => segs[2].blur());
    expect(tabIndexes(segs)).toEqual([-1, -1, 0]);
  });

  it('returns a controlled stop to tabStopIndex once focus leaves the bar', () => {
    const segs = renderBar({ tabStopIndex: 0 });
    act(() => segs[2].focus());
    // While focus is inside, the focused item is the stop, so Shift+Tab leaves.
    expect(tabIndexes(segs)).toEqual([-1, -1, 0]);
    act(() => segs[2].blur());
    expect(tabIndexes(segs)).toEqual([0, -1, -1]);
  });

  it('moves the stop off an item that becomes disabled without the bar re-rendering', async () => {
    const segs = renderBar();
    await act(async () => {
      segs[0].disabled = true;
    });
    expect(tabIndexes(segs)).toEqual([-1, 0, -1]);
  });

  it('leaves items of a nested roving container to that container', () => {
    function Outer() {
      const outer = useRovingTabIndex();
      return (
        <div ref={outer.rootRef} onKeyDown={outer.onKeyDown}>
          <button type="button">x</button>
          <Bar />
        </div>
      );
    }
    const { container } = render(<Outer />);
    const all = container.querySelectorAll<HTMLButtonElement>('button');
    // x is the outer stop; a is the inner one.
    expect(tabIndexes(all)).toEqual([0, 0, -1, -1]);
  });
});

describe('useRovingTabIndex — arrow navigation', () => {
  it('moves focus forward and backward on both axes by default', () => {
    const segs = renderBar();
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segs[1]);
    fireEvent.keyDown(segs[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(segs[2]);
    fireEvent.keyDown(segs[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(segs[1]);
    fireEvent.keyDown(segs[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(segs[0]);
  });

  it('moves the tab stop with focus', () => {
    const segs = renderBar();
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(tabIndexes(segs)).toEqual([-1, 0, -1]);
  });

  it('wraps at both ends', () => {
    const segs = renderBar();
    fireEvent.keyDown(segs[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(segs[2]);
    fireEvent.keyDown(segs[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segs[0]);
  });

  it('skips disabled items', () => {
    const segs = renderBar({ items: [{ label: 'a' }, { label: 'b', disabled: true }, { label: 'c' }] });
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segs[2]);
  });

  it('skips aria-disabled items, which stay focusable', () => {
    const segs = renderBar({ items: [{ label: 'a' }, { label: 'b', ariaDisabled: true }, { label: 'c' }] });
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segs[2]);
  });

  it('Home and End go to the first and last enabled item', () => {
    const segs = renderBar({ items: [{ label: 'a' }, { label: 'b' }, { label: 'c', disabled: true }] });
    fireEvent.keyDown(segs[0], { key: 'End' });
    expect(document.activeElement).toBe(segs[1]);
    fireEvent.keyDown(segs[1], { key: 'Home' });
    expect(document.activeElement).toBe(segs[0]);
  });

  it('reports the destination to onNavigate before focus moves', () => {
    let focusedAtCall: Element | null = null;
    const onNavigate = vi.fn(() => {
      focusedAtCall = document.activeElement;
    });
    const segs = renderBar({ onNavigate });
    act(() => segs[0].focus());
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith(1);
    expect(focusedAtCall).toBe(segs[0]);
  });

  it('indexes onNavigate over every item, disabled ones included', () => {
    const onNavigate = vi.fn();
    const segs = renderBar({ items: [{ label: 'a' }, { label: 'b', disabled: true }, { label: 'c' }], onNavigate });
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith(2);
  });

  it('does nothing when the only enabled item is the focused one', () => {
    const onNavigate = vi.fn();
    const segs = renderBar({
      items: [{ label: 'a' }, { label: 'b', disabled: true }, { label: 'c', disabled: true }],
      onNavigate,
    });
    const e = press(segs[0], 'ArrowRight');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('leaves other keys to the browser', () => {
    expect(press(renderBar()[0], 'Tab').defaultPrevented).toBe(false);
  });

  it('ignores keys from a focused element that is not an item', () => {
    function WithField() {
      const roving = useRovingTabIndex();
      return (
        <div ref={roving.rootRef} onKeyDown={roving.onKeyDown}>
          <button type="button">a</button>
          <input aria-label="size" />
          <button type="button">b</button>
        </div>
      );
    }
    const { container } = render(<WithField />);
    const field = container.querySelector('input')!;
    act(() => field.focus());
    const e = press(field, 'ArrowRight');
    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(field);
  });
});

describe('useRovingTabIndex — orientation', () => {
  it('walks only Left/Right when horizontal, leaving Up/Down to the page', () => {
    const segs = renderBar({ orientation: 'horizontal' });
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segs[1]);
    expect(press(segs[1], 'ArrowDown').defaultPrevented).toBe(false);
    expect(press(segs[1], 'ArrowUp').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(segs[1]);
  });

  it('walks only Down/Up when vertical, wrapping at both ends', () => {
    const segs = renderBar({ orientation: 'vertical' });
    fireEvent.keyDown(segs[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(segs[1]);
    fireEvent.keyDown(segs[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(segs[0]);
    fireEvent.keyDown(segs[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(segs[2]);
    fireEvent.keyDown(segs[2], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(segs[0]);
    expect(press(segs[0], 'ArrowRight').defaultPrevented).toBe(false);
    expect(press(segs[0], 'ArrowLeft').defaultPrevented).toBe(false);
  });

  it('keeps Home and End on either axis', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      const segs = renderBar({ orientation });
      fireEvent.keyDown(segs[1], { key: 'End' });
      expect(document.activeElement).toBe(segs[2]);
      fireEvent.keyDown(segs[2], { key: 'Home' });
      expect(document.activeElement).toBe(segs[0]);
      segs.view.unmount();
    }
  });

  it('does nothing in an empty container', () => {
    function Empty() {
      const roving = useRovingTabIndex();
      return <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} tabIndex={-1} />;
    }
    const { container } = render(<Empty />);
    expect(press(container.firstElementChild as HTMLElement, 'ArrowRight').defaultPrevented).toBe(false);
  });
});

describe('useRovingTabIndex — item selector', () => {
  it('counts only the elements itemSelector matches', () => {
    function Mixed() {
      const roving = useRovingTabIndex({ itemSelector: '.seg' });
      return (
        <div ref={roving.rootRef} onKeyDown={roving.onKeyDown}>
          <button type="button" className="seg">a</button>
          <button type="button">other</button>
          <button type="button" className="seg">b</button>
        </div>
      );
    }
    const { container } = render(<Mixed />);
    const [a, , b] = container.querySelectorAll<HTMLButtonElement>('button');
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(b);
  });
});

describe('useRovingTabIndex — activation', () => {
  it('Space and Enter call onActivate and suppress the native click', () => {
    const onActivate = vi.fn();
    const segs = renderBar({ onActivate });
    const space = press(segs[1], ' ');
    expect(onActivate).toHaveBeenCalledWith(1);
    expect(space.defaultPrevented).toBe(true);
    fireEvent.keyDown(segs[2], { key: 'Enter' });
    expect(onActivate).toHaveBeenLastCalledWith(2);
  });

  it('leaves Space and Enter alone without onActivate, so a button clicks normally', () => {
    expect(press(renderBar()[1], ' ').defaultPrevented).toBe(false);
  });
});

describe('rovingGridTarget', () => {
  // a b c
  // d e f
  // g
  const rows = [[0, 1, 2], [3, 4, 5], [6]];
  const all = Array(7).fill(true) as boolean[];

  it('moves a row on Up and Down, keeping the column', () => {
    expect(rovingGridTarget(1, 'ArrowDown', all, rows)).toBe(4);
    expect(rovingGridTarget(4, 'ArrowUp', all, rows)).toBe(1);
  });

  it('goes to the last item of a short row the column runs past', () => {
    expect(rovingGridTarget(5, 'ArrowDown', all, rows)).toBe(6);
    expect(rovingGridTarget(4, 'ArrowDown', all, rows)).toBe(6);
  });

  it('stops at the top and bottom rows rather than wrapping', () => {
    expect(rovingGridTarget(1, 'ArrowUp', all, rows)).toBeNull();
    expect(rovingGridTarget(6, 'ArrowDown', all, rows)).toBeNull();
  });

  it('steps Left and Right in reading order, across rows, wrapping at the ends', () => {
    expect(rovingGridTarget(2, 'ArrowRight', all, rows)).toBe(3);
    expect(rovingGridTarget(3, 'ArrowLeft', all, rows)).toBe(2);
    expect(rovingGridTarget(6, 'ArrowRight', all, rows)).toBe(0);
    expect(rovingGridTarget(0, 'ArrowLeft', all, rows)).toBe(6);
  });

  it('passes over a row whose item in that column is disabled', () => {
    const enabled = all.map((_, i) => i !== 4);
    expect(rovingGridTarget(1, 'ArrowDown', enabled, rows)).toBe(6);
  });

  it('keeps Home and End on the whole set', () => {
    expect(rovingGridTarget(4, 'Home', all, rows)).toBe(0);
    expect(rovingGridTarget(4, 'End', all, rows)).toBe(6);
  });
});

describe('useRovingTabIndex — columns', () => {
  function Grid(props: UseRovingTabIndexOptions & { groups: readonly (readonly string[])[] }) {
    const { groups, ...options } = props;
    const roving = useRovingTabIndex(options);
    return (
      <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} role="toolbar">
        {groups.map((g) => (
          <div key={g[0]} role="group">
            {g.map((label) => <button key={label} type="button">{label}</button>)}
          </div>
        ))}
      </div>
    );
  }
  const byName = (name: string) =>
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent === name)!;

  it('moves Up and Down by the column count', () => {
    render(<Grid columns={3} groups={[['a', 'b', 'c', 'd', 'e', 'f']]} />);
    fireEvent.keyDown(byName('b'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(byName('e'));
    fireEvent.keyDown(byName('e'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(byName('b'));
    fireEvent.keyDown(byName('b'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(byName('c'));
  });

  it('starts each group on a row of its own when groupSelector names them', () => {
    // a b c
    // d
    // e f
    render(<Grid columns={3} groupSelector='[role="group"]' groups={[['a', 'b', 'c', 'd'], ['e', 'f']]} />);
    fireEvent.keyDown(byName('b'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(byName('d'));
    fireEvent.keyDown(byName('d'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(byName('e'));
    fireEvent.keyDown(byName('c'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(byName('d'));
  });

  it('leaves Up and Down to the page at the edges', () => {
    render(<Grid columns={2} groups={[['a', 'b', 'c']]} />);
    expect(press(byName('a'), 'ArrowUp').defaultPrevented).toBe(false);
    expect(press(byName('c'), 'ArrowDown').defaultPrevented).toBe(false);
  });
});
