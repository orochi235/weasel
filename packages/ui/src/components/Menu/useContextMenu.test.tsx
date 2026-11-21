import { afterEach, expect, it } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider, useAction, useMenus } from '@weasel-js/routing/react';
import { ContextMenuHost } from './ContextMenuHost';
import { useContextMenu } from './useContextMenu';

afterEach(cleanup);

const del = { id: 'delete', label: 'Delete', invoker: { timing: 'immediate' as const, run: () => {} } };
const MENUS = [{ id: 'row', menu: pref.group('', { delete: pref.action('delete') }) }];
const PARAMS = { nodeId: 'n1' };

function Row({ menu }: { menu: string }) {
  useAction(del);
  useMenus(MENUS);
  const onContextMenu = useContextMenu(menu, { params: PARAMS });
  return <div onContextMenu={onContextMenu}>row</div>;
}

const mount = (menu: string) => render(<ActionsProvider><Row menu={menu} /><ContextMenuHost /></ActionsProvider>);

it('opens the named menu at the pointer and blocks the browser menu', () => {
  mount('row');
  const ev = fireEvent.contextMenu(screen.getByText('row'), { clientX: 20, clientY: 30 });
  expect(ev).toBe(false);
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
});

it('leaves the browser menu alone when no such menu exists', () => {
  mount('missing');
  const ev = fireEvent.contextMenu(screen.getByText('row'), { clientX: 20, clientY: 30 });
  expect(ev).toBe(true);
  expect(screen.queryByRole('menu')).toBeNull();
});

it('highlights the first row of a menu raised from the keyboard, and none of one raised by the pointer', () => {
  mount('row');
  const fire = (init: Record<string, unknown>) => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    Object.assign(ev, init);
    fireEvent(screen.getByText('row'), ev);
    return screen.getByRole('menu').getAttribute('aria-activedescendant');
  };
  expect(fire({})).toBeNull();
  expect(fire({ pointerType: 'mouse' })).toBeNull();
  expect(fire({ pointerType: '' })).toBe(screen.getByRole('menuitem', { name: 'Delete' }).id);
  expect(fire({ mozInputSource: 6 })).toBe(screen.getByRole('menuitem', { name: 'Delete' }).id);
});
