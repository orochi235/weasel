import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import { CommandBar } from './CommandBar';
import { drawPrefs } from './prefs';
import { StripDock } from './surfaces/StripSurfaces';
import { renderWithIcons } from './testIcons';

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

const ACTIONS: Action[] = [
  { id: 'join', label: 'Join', group: 'path', invoker: { timing: 'immediate', run: () => {} } },
  { id: 'union', label: 'Unite', group: 'pathfinder', invoker: { timing: 'immediate', run: () => {} } },
  { id: 'bringToFront', label: 'Bring to front', group: 'reorder', invoker: { timing: 'immediate', run: () => {} } },
];

function Register({ a }: { a: Action }) {
  useAction(a);
  return null;
}

function App() {
  return (
    <ActionsProvider>
      {ACTIONS.map((a) => <Register key={a.id} a={a} />)}
      <CommandBar />
      <StripDock>
        <div data-testid="workspace" />
      </StripDock>
    </ActionsProvider>
  );
}

const dock = () => document.querySelector<HTMLElement>('[data-dock="strip"]')!;
const toolbarsInDock = () => within(dock()).getAllByRole('toolbar').map((t) => t.getAttribute('aria-label'));
const altRight = (name: string) =>
  act(() => void fireEvent.keyDown(screen.getByRole('button', { name: `Move ${name} toolbar` }), { key: 'ArrowRight', altKey: true }));
const setPath = (state: object) => act(() => {
  const all = drawPrefs().get('ui.surfaces');
  drawPrefs().set('ui.surfaces', { ...all, path: { ...all.path, ...state } });
});

beforeEach(() => {
  drawPrefs().reset();
});
afterEach(cleanup);

describe('the toolbar dock', () => {
  it('draws the strip’s assets in a dock row round the workspace, not in the command row', () => {
    renderWithIcons(<App />);
    const commands = screen.getByRole('toolbar', { name: 'Actions' });
    for (const name of ['Arrange', 'Pathfinder', 'Path', 'Loupe']) {
      expect(within(commands).queryByRole('toolbar', { name })).toBeNull();
      expect(within(dock()).getByRole('toolbar', { name })).toBeDefined();
    }
    expect(toolbarsInDock()).toEqual(['Arrange', 'Pathfinder', 'Path', 'Loupe']);
    expect(dock().closest('[data-dock-edge]')).toHaveAttribute('data-dock-edge', 'top');
    expect(screen.getByTestId('workspace')).toBeInTheDocument();
  });

  it('writes a moved bar’s place to ui.toolbars', () => {
    renderWithIcons(<App />);
    altRight('Arrange');
    expect(drawPrefs().get('ui.toolbars').docks.strip).toEqual([['pathfinder', 'arrange', 'path', 'loupe']]);
    expect(toolbarsInDock()).toEqual(['Pathfinder', 'Arrange', 'Path', 'Loupe']);
  });

  it('keeps a hidden asset’s slot, so it comes back where it was', () => {
    renderWithIcons(<App />);
    setPath({ hidden: true });
    expect(toolbarsInDock()).toEqual(['Arrange', 'Pathfinder', 'Loupe']);
    altRight('Pathfinder');
    expect(drawPrefs().get('ui.toolbars').docks.strip).toEqual([['arrange', 'path', 'loupe', 'pathfinder']]);
    setPath({ hidden: false });
    expect(toolbarsInDock()).toEqual(['Arrange', 'Path', 'Loupe', 'Pathfinder']);
  });
});
