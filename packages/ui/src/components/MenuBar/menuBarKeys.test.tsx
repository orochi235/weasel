import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionsProvider,
  ActiveToolContextProvider,
  DepRegistryProvider,
  useAction,
  useActionsRegistry,
  useGestureDispatcher,
  type Action,
  type ActionsRegistry,
} from '@weasel-js/core';
import { isApplePlatform } from '@weasel-js/gestures';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { MenuBar, type MenuAccessChord } from './MenuBar';

afterEach(cleanup);

const ran: string[] = [];
beforeEach(() => { ran.length = 0; });

const INITIAL = [{ channel: '*', phase: 'initial' }] as const;
const act1 = (id: string, label: string, defaultBinding?: Action['defaultBinding']): Action => ({
  id, label, ...(defaultBinding ? { defaultBinding } : {}), invoker: { timing: 'immediate', run: () => { ran.push(id); } },
});
const ACTIONS = [
  act1('file.new', 'New'),
  act1('file.open', 'Open'),
  act1('edit.undo', 'Undo', [{ kind: 'key', key: 'z', mods: { mod: true }, phase: [...INITIAL] }]),
  act1('app.find', 'Find', [{ kind: 'key', key: 'f', code: 'KeyF', mods: { alt: true }, phase: [...INITIAL] }]),
];

const SCHEMA: PrefGroup = pref.group('', {
  file: {
    ...pref.group('File', {
      more: pref.group('More', { open: pref.action('file.open') }, { as: 'menu' }),
      new: pref.action('file.new'),
    }, { as: 'menu' }),
    access: 'f',
  },
  edit: pref.group('Edit', { undo: pref.action('edit.undo') }, { as: 'menu' }),
});

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

/** The app's own keys, on a dispatcher of its own as an app's canvas would run one. */
function AppKeys() {
  const registry = useActionsRegistry() as ActionsRegistry;
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: new Map(), channels: { contextMenu: false, ingest: false },
  });
  return null;
}

function setup(accessChord?: MenuAccessChord) {
  render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          {ACTIONS.map((a) => <Register key={a.id} action={a} />)}
          <AppKeys />
          <button type="button">Before</button>
          <input aria-label="Name" />
          <MenuBar schema={SCHEMA} {...(accessChord ? { accessChord } : {})} />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>,
  );
  return { file: screen.getByRole('menuitem', { name: 'File' }) };
}

const rowNames = () => screen.getAllByRole('menuitem').filter((el) => el.closest('[role="menu"]')).map((el) => el.textContent);
/** Option+F as macOS reports it: the character it types, with the physical key in `code`. */
const altF = { key: 'ƒ', code: 'KeyF', altKey: true };

describe('MenuBar keys', () => {
  it('focuses the first title on F10', () => {
    const { file } = setup();
    fireEvent.keyDown(window, { key: 'F10', code: 'F10' });
    expect(document.activeElement).toBe(file);
  });

  it('opens a title’s menu on Alt and its access letter, first row highlighted', () => {
    setup();
    fireEvent.keyDown(document.body, altF);
    const menu = screen.getByRole('menu');
    expect(rowNames()).toEqual(['More', 'New']);
    expect(menu.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: 'More' }).id);
  });

  it('opens nothing on Alt and a letter no title declares', () => {
    setup();
    fireEvent.keyDown(document.body, { key: '´', code: 'KeyE', altKey: true });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('takes the chord the host gives instead of Alt', () => {
    setup({ ctrl: true, alt: true });
    fireEvent.keyDown(document.body, altF);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.keyDown(document.body, { ...altF, ctrlKey: true });
    expect(rowNames()).toEqual(['More', 'New']);
  });

  it('leaves an app key binding to run once with the bar mounted', () => {
    setup();
    const mac = isApplePlatform();
    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', metaKey: mac, ctrlKey: !mac });
    expect(ran).toEqual(['edit.undo']);
  });

  it('takes an access chord ahead of an app binding on the same keys', () => {
    setup();
    fireEvent.keyDown(document.body, altF);
    expect(screen.getByRole('menu')).toBeDefined();
    expect(ran).toEqual([]);
  });

  it('leaves a disabled title’s access chord to the app', () => {
    render(
      <DepRegistryProvider>
        <ActionsProvider>
          <ActiveToolContextProvider>
            {ACTIONS.map((a) => <Register key={a.id} action={a} />)}
            <AppKeys />
            <MenuBar schema={{ ...SCHEMA, children: { ...SCHEMA.children, on: pref.boolean('On', false), file: { ...SCHEMA.children.file!, enableIf: { path: 'on' } } } }} values={{ on: false }} />
          </ActiveToolContextProvider>
        </ActionsProvider>
      </DepRegistryProvider>,
    );
    fireEvent.keyDown(document.body, altF);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(ran).toEqual(['app.find']);
  });

  it('leaves the access chord to a focused text input', () => {
    setup();
    const input = screen.getByRole('textbox', { name: 'Name' });
    act(() => input.focus());
    fireEvent.keyDown(input, altF);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('MenuBar focus after a dismiss', () => {
  it('gives focus back, not to the title, when a wheel closes a menu after Escape closed only its submenu', () => {
    const { file } = setup();
    const before = screen.getByRole('button', { name: 'Before' });
    act(() => before.focus());
    act(() => file.focus());
    fireEvent.keyDown(file, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    fireEvent.wheel(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(before);
  });
});
