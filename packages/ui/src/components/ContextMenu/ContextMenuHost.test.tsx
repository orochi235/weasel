import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionDisabledReason, ActionsProvider, useAction, useMenuHost, useMenus, type MenuDef, type MenuHost,
} from '@weasel-js/core';
import { ContextMenuHost } from './ContextMenuHost';

afterEach(cleanup);

const ran: string[] = [];
const act1 = (id: string, extra = {}) => ({
  id, label: id[0]!.toUpperCase() + id.slice(1),
  invoker: { timing: 'immediate' as const, run: () => { ran.push(id); } }, ...extra,
});
const MENUS: MenuDef[] = [{
  id: 'm',
  sections: [[{ action: 'cut' }, { action: 'copy' }], [{ submenu: 'arr', label: 'Arrange', sections: [[{ action: 'forward' }]] }]],
}];
const GATED: MenuDef[] = [{ id: 'g', sections: [[{ action: 'gated' }]] }];

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

  it('closes on Escape and returns focus where it was (Review Focus 5)', () => {
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

  it('a second open replaces the first (Review Focus 3)', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt(10, 10);
    openAt(50, 50);
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('an item disabled since opening does nothing when chosen (Review Focus 4)', () => {
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
