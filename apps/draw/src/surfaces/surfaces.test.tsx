import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import { ContextMenuHost } from '@weasel-js/ui/components/ContextMenu';
import { CommandBar } from '../CommandBar';
import { drawPrefs } from '../prefs';
import { RightSidebar } from '../RightSidebar';
import { StripSurfaces } from './StripSurfaces';
import type { SidebarHost } from './types';
import { renderWithIcons } from '../testIcons';

// Same in-memory Storage shim as prefs.test.ts: jsdom 26 + Node 26 can
// leave `window.localStorage` undefined.
beforeAll(() => {
  if (typeof window !== 'undefined' && !window.localStorage) {
    const store = new Map<string, string>();
    const fakeStorage: Storage = {
      get length() { return store.size; },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => { store.delete(k); },
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => fakeStorage });
  }
});

const action = (id: string, label: string, group: string): Action => ({
  id, label, group, invoker: { timing: 'immediate', run: () => {} },
});

const ACTIONS = [
  action('join', 'Join', 'path'),
  action('averageAnchors', 'Average', 'anchors'),
  action('union', 'Unite', 'pathfinder'),
  action('bringToFront', 'Bring to front', 'reorder'),
];

function Register({ a }: { a: Action }) {
  useAction(a);
  return null;
}

function App() {
  return (
    <ActionsProvider>
      {ACTIONS.map((a) => <Register key={a.id} a={a} />)}
      <div data-testid="strip">
        <CommandBar surfaces={<StripSurfaces />} />
      </div>
      <div data-testid="sidebar">
        <RightSidebar {...({} as SidebarHost)} />
      </div>
      <ContextMenuHost />
    </ActionsProvider>
  );
}

const strip = () => within(screen.getByTestId('strip'));
const sidebar = () => within(screen.getByTestId('sidebar'));
const click = (el: Element) => act(() => { fireEvent.click(el); });

beforeEach(() => {
  drawPrefs().reset();
  // The code-drawn panels read a document this test has none of.
  drawPrefs().set('ui.surfaces', {
    properties: { hidden: true }, colors: { hidden: true }, layers: { hidden: true }, history: { hidden: true },
  });
});
afterEach(cleanup);

describe('surface assets', () => {
  it('draw as labeled toolbars in the strip by default', () => {
    renderWithIcons(<App />);
    for (const name of ['Arrange', 'Pathfinder', 'Path']) expect(strip().getByRole('toolbar', { name })).toBeDefined();
    expect(within(strip().getByRole('toolbar', { name: 'Path' })).getByRole('button', { name: 'Join' })).toBeDefined();
    expect(sidebar().queryByText('Path')).toBeNull();
  });

  it('open what does not fit on the line from a menu, so a long toolbar cannot widen the page', () => {
    // A proxy: jsdom has no layout, so this checks the mode the bar runs in, not the page's width.
    renderWithIcons(<App />);
    for (const name of ['Arrange', 'Pathfinder', 'Path']) {
      expect(strip().getByRole('toolbar', { name })).toHaveAttribute('data-overflow', 'menu');
    }
  });

  it('move from the strip to the sidebar, to a menu button, and back to the strip', () => {
    renderWithIcons(<App />);
    act(() => { fireEvent.contextMenu(strip().getByRole('toolbar', { name: 'Path' })); });
    expect(screen.queryByRole('menuitem', { name: 'Show as toolbar' })).toBeNull();
    click(screen.getByRole('menuitem', { name: 'Show as panel' }));

    expect(strip().queryByRole('toolbar', { name: 'Path' })).toBeNull();
    expect(sidebar().getByRole('button', { name: 'Path', expanded: true })).toBeDefined();
    expect(sidebar().getByRole('button', { name: 'Join' })).toBeDefined();

    click(sidebar().getByRole('button', { name: /Show Path as/ }));
    click(screen.getByRole('menuitem', { name: 'Show as menu' }));

    expect(sidebar().queryByRole('button', { name: 'Join' })).toBeNull();
    const trigger = strip().getByRole('button', { name: 'Path' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Join' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Average' })).toBeDefined();
    click(screen.getByRole('menuitem', { name: 'Show as toolbar' }));

    expect(strip().getByRole('toolbar', { name: 'Path' })).toBeDefined();
    expect(drawPrefs().get('ui.surfaces').path).toEqual({ surface: 'bar', hidden: false });
  });
});
