import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionsProvider,
  ActiveToolContextProvider,
  DepRegistryProvider,
  useActionsRegistry,
  useGestureDispatcher,
  type Action,
  type ActionsRegistry,
  type UseGestureDispatcherOptions,
} from '@weasel-js/core';
import { isApplePlatform } from '@weasel-js/gestures';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { MenuBar, type MenuAccessChord } from './MenuBar';
import { RegisterActions } from '../../testing/registerAction';

/** Every dispatcher mounted, by its options: how the test reaches the registry the bar's own dispatcher reads. */
const mounted = vi.hoisted(() => [] as UseGestureDispatcherOptions[]);
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useGestureDispatcher: (opts: UseGestureDispatcherOptions) => {
      mounted.push(opts);
      core.useGestureDispatcher(opts);
    },
  };
});

afterEach(cleanup);

const ran: string[] = [];
beforeEach(() => { ran.length = 0; mounted.length = 0; });

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
  file: { ...pref.group('File', { new: pref.action('file.new'), open: pref.action('file.open') }, { as: 'menu' }), access: 'f' },
  edit: pref.group('Edit', { undo: pref.action('edit.undo') }, { as: 'menu' }),
});

/** SCHEMA with File disabled until `on` is set. */
const FILE_GATED: PrefGroup = pref.group('', {
  on: pref.boolean('On', false),
  file: { ...SCHEMA.children.file!, enableIf: { path: 'on' } },
  edit: SCHEMA.children.edit!,
});

/** The app's own keys, on a dispatcher of its own as an app's canvas would run one. */
function AppKeys() {
  const registry = useActionsRegistry() as ActionsRegistry;
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: new Map(), channels: { contextMenu: false, ingest: false },
  });
  return null;
}

function setup({ accessChord, schema = SCHEMA }: { accessChord?: MenuAccessChord; schema?: PrefGroup } = {}) {
  render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <RegisterActions actions={ACTIONS} />
          <AppKeys />
          <input aria-label="Name" />
          <MenuBar schema={schema} values={{ on: false }} {...(accessChord ? { accessChord } : {})} />
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
    expect(rowNames()).toEqual(['New', 'Open']);
    expect(menu.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: 'New' }).id);
  });

  it('reads only the first character of a declared letter', () => {
    setup({ schema: { ...SCHEMA, children: { ...SCHEMA.children, file: { ...SCHEMA.children.file!, access: 'fx' } } } as PrefGroup });
    fireEvent.keyDown(document.body, altF);
    expect(rowNames()).toEqual(['New', 'Open']);
  });

  it('opens nothing on Alt and a letter no title declares', () => {
    setup();
    fireEvent.keyDown(document.body, { key: '´', code: 'KeyE', altKey: true });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens nothing on Ctrl+Alt and a letter under the default chord', () => {
    setup();
    fireEvent.keyDown(document.body, { ...altF, ctrlKey: true });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('takes the chord the host gives instead of Alt', () => {
    setup({ accessChord: { ctrl: true, alt: true } });
    fireEvent.keyDown(document.body, altF);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.keyDown(document.body, { ...altF, ctrlKey: true });
    expect(rowNames()).toEqual(['New', 'Open']);
  });

  it('routes its keys through a registry holding only its own two actions, none of the app’s', () => {
    setup();
    const own = mounted.find((o) => o.keyboard === 'first');
    expect(own?.actions.list().map((a) => a.id).sort()).toEqual(['menu.bar', 'menu.open']);
  });

  it('runs an app key binding once, through the app, with the bar mounted', () => {
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
    setup({ schema: FILE_GATED });
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
