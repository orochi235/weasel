import { afterEach, describe, expect, it, vi } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import {
  ActionDisabledReason, ActionsProvider, useAction, useMenuHost, useMenus, type MenuDef, type MenuHost,
} from '@weasel-js/core';
import type { MenuEntry } from '@weasel-js/menu';
import { ContextMenuHost, OpenPanels } from './ContextMenuHost';

afterEach(cleanup);

const ran: string[] = [];
const act1 = (id: string, extra = {}) => ({
  id, label: id[0]!.toUpperCase() + id.slice(1),
  invoker: { timing: 'immediate' as const, run: () => { ran.push(id); } }, ...extra,
});
const MENUS: MenuDef[] = [{
  id: 'm',
  menu: pref.group('', {
    edit: pref.group('', { cut: pref.action('cut'), copy: pref.action('copy') }),
    arr: pref.group('Arrange', { forward: pref.action('forward') }, { as: 'menu' }),
  }),
}];
const GATED: MenuDef[] = [{ id: 'g', menu: pref.group('', { gated: pref.action('gated') }) }];

let host: MenuHost | null = null;
function Setup() {
  useAction(act1('cut')); useAction(act1('copy')); useAction(act1('forward'));
  useMenus(MENUS);
  host = useMenuHost();
  return <ContextMenuHost />;
}

function openAt(x = 10, y = 10, source: 'pointer' | 'keyboard' = 'pointer') {
  act(() => { host!.open({ menu: 'm', client: { x, y }, source }); });
}

describe('ContextMenuHost', () => {
  it('renders nothing until a menu opens', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders rows with menu roles and a separator', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt();
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((r) => r.textContent)).toEqual(['Cut', 'Copy', 'Arrange']);
    expect(screen.getByRole('separator')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Arrange' }).getAttribute('aria-haspopup')).toBe('menu');
  });

  it('runs an item on click and closes', () => {
    ran.length = 0;
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
    expect(ran).toEqual(['copy']);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('drives the highlight from the keyboard and opens a submenu', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt(10, 10, 'keyboard');
    const menu = screen.getByRole('menu');
    expect(document.activeElement).toBe(menu);
    expect(menu.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: 'Cut' }).id);
    fireEvent.keyDown(menu, { key: 'End' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    expect(screen.getAllByRole('menu')).toHaveLength(2);
  });

  it('leaves a key held with Ctrl, Meta or Alt to the app, not to typeahead', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt(10, 10, 'keyboard');
    const menu = screen.getByRole('menu');
    const cut = screen.getByRole('menuitem', { name: 'Cut' }).id;
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      fireEvent.keyDown(menu, { key: 'c', ...mod });
      fireEvent.keyDown(menu, { key: 'ArrowDown', ...mod });
      expect(menu.getAttribute('aria-activedescendant')).toBe(cut);
    }
    fireEvent.keyDown(menu, { key: 'c' });
    expect(menu.getAttribute('aria-activedescendant')).not.toBe(cut);
  });

  it('keeps every key inside an open menu, handled or not', () => {
    const reactSpy = vi.fn();
    const windowSpy = vi.fn();
    window.addEventListener('keydown', windowSpy);
    try {
      render(<ActionsProvider><div onKeyDown={reactSpy}><Setup /></div></ActionsProvider>);
      openAt(10, 10, 'keyboard');
      const menu = screen.getByRole('menu');
      fireEvent.keyDown(menu, { key: 'F10', shiftKey: true });
      fireEvent.keyDown(menu, { key: 'ContextMenu' });
      fireEvent.keyDown(menu, { key: 'c', metaKey: true });
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(reactSpy).not.toHaveBeenCalled();
      expect(windowSpy).not.toHaveBeenCalled();
      expect(screen.getAllByRole('menu')).toHaveLength(1);
    } finally {
      window.removeEventListener('keydown', windowSpy);
    }
  });

  it('closes on Escape and returns focus where it was', () => {
    render(<ActionsProvider><button>canvas</button><Setup /></ActionsProvider>);
    const before = screen.getByRole('button', { name: 'canvas' });
    before.focus();
    openAt();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it('returns focus where it was after a choice', () => {
    render(<ActionsProvider><button>canvas</button><Setup /></ActionsProvider>);
    const before = screen.getByRole('button', { name: 'canvas' });
    before.focus();
    openAt();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cut' }));
    expect(document.activeElement).toBe(before);
  });

  it('closes on a press outside, a wheel outside, and window blur', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    for (const dismiss of [
      () => fireEvent.pointerDown(document.body),
      () => fireEvent.wheel(document.body),
      () => fireEvent.blur(window),
    ]) {
      openAt();
      act(dismiss);
      expect(screen.queryByRole('menu')).toBeNull();
    }
  });

  it('closes on resize', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt();
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('works under StrictMode: keys move the highlight and a click runs the item', () => {
    ran.length = 0;
    render(<StrictMode><ActionsProvider><Setup /></ActionsProvider></StrictMode>);
    openAt(10, 10, 'keyboard');
    const menu = screen.getByRole('menu');
    expect(document.activeElement).toBe(menu);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(menu.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: 'Copy' }).id);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
    expect(ran).toEqual(['copy']);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('a replacing open keeps focus on the new menu, and the close returns it once', () => {
    render(<ActionsProvider><button>canvas</button><Setup /></ActionsProvider>);
    const before = screen.getByRole('button', { name: 'canvas' });
    before.focus();
    const focus = vi.spyOn(before, 'focus');
    openAt(10, 10);
    openAt(50, 50);
    expect(document.activeElement).toBe(screen.getByRole('menu'));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(document.activeElement).toBe(before);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('labels a submenu by its row, and the row controls it', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt(10, 10, 'keyboard');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
    const row = screen.getByRole('menuitem', { name: 'Arrange' });
    const sub = screen.getAllByRole('menu')[1]!;
    expect(sub.getAttribute('aria-labelledby')).toBe(row.id);
    expect(sub.id).toBeTruthy();
    expect(row.getAttribute('aria-controls')).toBe(sub.id);
  });

  it('keeps a right-click inside the menu from reaching the app', () => {
    const spy = vi.fn();
    render(<ActionsProvider><div onContextMenu={spy}><Setup /></div></ActionsProvider>);
    openAt();
    fireEvent.contextMenu(screen.getByRole('menuitem', { name: 'Cut' }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('a second open replaces the first', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt(10, 10);
    openAt(50, 50);
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('an item disabled since opening does nothing when chosen', () => {
    ran.length = 0;
    let allowed = true;
    function Gate() {
      useAction(act1('gated', { enabled: () => (allowed ? true : ActionDisabledReason.NotApplicable) }));
      useMenus(GATED);
      return null;
    }
    render(<ActionsProvider><Gate /><Setup /></ActionsProvider>);
    act(() => { host!.open({ menu: 'g', client: { x: 0, y: 0 } }); });
    allowed = false;
    expect(() => fireEvent.click(screen.getByRole('menuitem', { name: 'Gated' }))).not.toThrow();
    expect(ran).toEqual([]);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('ContextMenuHost access letters', () => {
  it('runs a row on its declared access letter', () => {
    ran.length = 0;
    const menus: MenuDef[] = [{ id: 'a', menu: pref.group('', { cut: pref.action('cut', { access: 's' }) }) }];
    function Access() {
      useAction(act1('cut'));
      useMenus(menus);
      host = useMenuHost();
      return <ContextMenuHost />;
    }
    render(<ActionsProvider><Access /></ActionsProvider>);
    act(() => { host!.open({ menu: 'a', client: { x: 0, y: 0 }, source: 'keyboard' }); });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 's' });
    expect(ran).toEqual(['cut']);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

const item = (key: string, extra: Partial<Extract<MenuEntry, { kind: 'item' }>> = {}): MenuEntry =>
  ({ kind: 'item', key, label: key, run: () => { ran.push(key); }, ...extra });
const panels = (entries: MenuEntry[], extra: Partial<Parameters<typeof OpenPanels>[0]> = {}) => {
  const close = vi.fn();
  const open = { seq: 1, entries, client: { x: 0, y: 0 }, source: 'pointer' as const };
  render(<OpenPanels open={open} close={close} {...extra} />);
  return close;
};

describe('menu rows that are links', () => {
  it('draws an href row as an anchor that keeps the menuitem role', () => {
    panels([item('docs', { href: '/docs' })]);
    const row = screen.getByRole('menuitem', { name: 'docs' });
    expect(row.tagName).toBe('A');
    expect(row.getAttribute('href')).toBe('/docs');
  });

  it('a plain click runs the row, navigates and closes', () => {
    ran.length = 0;
    window.location.hash = '';
    const close = panels([item('docs', { href: '#docs' })]);
    const notPrevented = fireEvent.click(screen.getByRole('menuitem', { name: 'docs' }));
    expect(notPrevented).toBe(false);
    expect(ran).toEqual(['docs']);
    expect(window.location.hash).toBe('#docs');
    expect(close).toHaveBeenCalled();
    window.location.hash = '';
  });

  it('a Meta-click, Ctrl-click, Shift-click or middle click is left to the browser and closes', () => {
    ran.length = 0;
    window.location.hash = '';
    for (const fire of [
      (el: Element) => fireEvent.click(el, { metaKey: true }),
      (el: Element) => fireEvent.click(el, { ctrlKey: true }),
      (el: Element) => fireEvent.click(el, { shiftKey: true }),
      (el: Element) => fireEvent(el, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 })),
    ]) {
      const close = panels([item('docs', { href: '#docs' })]);
      expect(fire(screen.getByRole('menuitem', { name: 'docs' }))).toBe(true);
      expect(close).toHaveBeenCalledTimes(1);
      cleanup();
    }
    expect(window.location.hash).toBe('');
    expect(ran).toEqual([]);
  });

  it('a release with Meta, Ctrl or Shift held opens the link in a new tab and closes', () => {
    ran.length = 0;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      for (const mod of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }]) {
        const close = panels([item('docs', { href: '/docs' })], { releaseRuns: true });
        fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'docs' }), mod);
        expect(open).toHaveBeenLastCalledWith('/docs', '_blank');
        expect(close).toHaveBeenCalledTimes(1);
        cleanup();
      }
      expect(ran).toEqual([]);
    } finally {
      open.mockRestore();
    }
  });

  it('marks the current row', () => {
    panels([item('here', { href: '/here', current: true }), item('there', { href: '/there' })]);
    expect(screen.getByRole('menuitem', { name: 'here' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('menuitem', { name: 'there' }).hasAttribute('aria-current')).toBe(false);
  });

  it('keeps a declared letter that is absent from its label working, with nothing underlined', () => {
    ran.length = 0;
    panels([item('File', { access: 'x' })]);
    const row = screen.getByRole('menuitem', { name: 'File' });
    expect(row.querySelector('span span')).toBeNull();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'x' });
    expect(ran).toEqual(['File']);
  });
});

describe('OpenPanels bar hooks', () => {
  it('releaseRuns: a pointerup over a row presses it', () => {
    ran.length = 0;
    panels([item('a'), item('b')], { releaseRuns: true });
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'b' }));
    expect(ran).toEqual(['b']);
  });

  it('releaseRuns: a pointerup over a disabled row runs nothing and still disarms', () => {
    ran.length = 0;
    panels([item('a', { disabled: true }), item('c')], { releaseRuns: true });
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'a' }));
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'c' }));
    expect(ran).toEqual([]);
  });

  it('releaseRuns: a new menu through the same OpenPanels re-arms while the prop stays true', () => {
    ran.length = 0;
    const close = vi.fn();
    const mk = (seq: number, entries: MenuEntry[]) => ({ seq, entries, client: { x: 0, y: 0 }, source: 'pointer' as const });
    const { rerender } = render(<OpenPanels open={mk(1, [item('a')])} close={close} releaseRuns />);
    fireEvent.pointerUp(document.body);
    rerender(<OpenPanels open={mk(2, [item('x')])} close={close} releaseRuns />);
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'x' }));
    expect(ran).toEqual(['x']);
  });

  it('releaseRuns: flipping it on a rerender keeps the same row elements', () => {
    const close = vi.fn();
    const open = { seq: 1, entries: [item('a')], client: { x: 0, y: 0 }, source: 'pointer' as const };
    const { rerender } = render(<OpenPanels open={open} close={close} />);
    const before = screen.getByRole('menuitem', { name: 'a' });
    rerender(<OpenPanels open={open} close={close} releaseRuns />);
    expect(screen.getByRole('menuitem', { name: 'a' })).toBe(before);
  });

  it('releaseRuns: the release that presses a row disarms, so a second one runs nothing', () => {
    ran.length = 0;
    const more: MenuEntry = { kind: 'submenu', key: 'more', label: 'More', entries: [item('inner')] };
    panels([more], { releaseRuns: true });
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'More' }));
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'inner' }));
    expect(ran).toEqual([]);
  });

  it('releaseRuns: a pointercancel disarms', () => {
    ran.length = 0;
    panels([item('a')], { releaseRuns: true });
    fireEvent.pointerCancel(document.body);
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'a' }));
    expect(ran).toEqual([]);
  });

  it('without releaseRuns a pointerup presses nothing', () => {
    ran.length = 0;
    panels([item('a')]);
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'a' }));
    expect(ran).toEqual([]);
  });

  it('inside: a press on an extra target does not dismiss', () => {
    const extra = document.createElement('button');
    document.body.append(extra);
    try {
      const close = panels([item('a')], { inside: (t) => t === extra });
      fireEvent.pointerDown(extra);
      expect(close).not.toHaveBeenCalled();
      fireEvent.pointerDown(document.body);
      expect(close).toHaveBeenCalled();
    } finally {
      extra.remove();
    }
  });

  it('onEdge: ArrowLeft with no submenu open reaches the callback', () => {
    const onEdge = vi.fn();
    panels([item('a')], { onEdge });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
    expect(onEdge).toHaveBeenCalledWith(-1);
  });
});
