import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { ActionsProvider, DepRegistryProvider, SceneCanvas, createScene, useLatest } from '@weasel-js/core';
import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { useMemo } from 'react';
import { appCommandsContribution, type AppCommands } from '../appCommands';
import { DRAW_MENU_BAR } from '../menuBar';
import { drawPrefs } from '../prefs';
import { RightSidebar } from '../RightSidebar';
import { renderWithIcons } from '../testIcons';
import { CHROME_ITEMS, ShowChrome } from './chrome';
import { StripDock } from './StripSurfaces';
import { useChromeCommands } from './surfaceState';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
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

const noop = () => {};

/** The menu bar, the strip, the right sidebar, and a status bar stand-in, with the app's commands reading the real prefs. */
function App() {
  const chrome = useChromeCommands();
  const commands: AppCommands = {
    gridVisible: false, toggleGrid: noop, snapToGrid: false, toggleSnap: noop,
    pathDirection: false, togglePathDirection: noop, symmetryOn: false, toggleSymmetry: noop,
    canReleaseCompound: false, releaseCompound: noop, openPrefs: noop, openPalette: noop,
    ...chrome,
  };
  const ref = useLatest(commands);
  const ambient = useMemo(() => [appCommandsContribution(() => ref.current)], [ref]);
  const scene = useMemo(() => createScene<{ kind: 'rect' }, 'main', { x: number; y: number; width: number; height: number }>(
    { systemLayers: [{ id: 'main' }] },
  ), []);
  return (
    <>
      <MenuBar schema={DRAW_MENU_BAR} />
      <div data-testid="strip"><StripDock /></div>
      <div data-testid="sidebar"><RightSidebar /></div>
      <ShowChrome id="statusBar"><div role="status">status</div></ShowChrome>
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ambient={ambient} />
    </>
  );
}

function setup() {
  renderWithIcons(
    <DepRegistryProvider>
      <ActionsProvider>
        <App />
      </ActionsProvider>
    </DepRegistryProvider>,
  );
}

const click = (el: Element) => act(() => { fireEvent.click(el); });
const openView = () => click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'View' }));
/** A chrome row by its label: these rows have no shortcut, so the accessible name is the label alone. */
const row = (name: string) => within(screen.getAllByRole('menu').at(-1)!).getByRole('menuitemcheckbox', { name });

beforeEach(() => {
  drawPrefs().reset();
  // The code-drawn panels read a document this test has none of.
  drawPrefs().set('ui.surfaces', {
    properties: { hidden: true }, colors: { hidden: true }, layers: { hidden: true }, history: { hidden: true },
  });
});
afterEach(cleanup);

describe('View menu chrome toggles', () => {
  it('lists every toggleable toolbar and panel, checked while shown', () => {
    setup();
    openView();
    for (const { label } of CHROME_ITEMS) {
      const shown = !['Properties', 'Colors', 'Layers', 'History'].includes(label);
      expect(row(label)).toHaveAttribute('aria-checked', String(shown));
    }
  });

  it('hides a toolbar from the menu, and shows it again', () => {
    setup();
    expect(within(screen.getByTestId('strip')).getByRole('toolbar', { name: 'Arrange' })).toBeDefined();
    openView();
    click(row('Arrange'));
    expect(within(screen.getByTestId('strip')).queryByRole('toolbar', { name: 'Arrange' })).toBeNull();
    expect(drawPrefs().get('ui.surfaces').arrange?.hidden).toBe(true);
    openView();
    expect(row('Arrange')).toHaveAttribute('aria-checked', 'false');
    click(row('Arrange'));
    expect(within(screen.getByTestId('strip')).getByRole('toolbar', { name: 'Arrange' })).toBeDefined();
  });

  it('hides chrome that is not a surface asset, such as the status bar', () => {
    setup();
    expect(screen.getByRole('status')).toBeDefined();
    openView();
    click(row('Status bar'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(drawPrefs().get('ui.surfaces').statusBar?.hidden).toBe(true);
  });

  it("unchecks a panel's row when the panel's own Hide button closes it", () => {
    drawPrefs().set('ui.surfaces', { ...drawPrefs().get('ui.surfaces'), arrange: { surface: 'panel' } });
    setup();
    const sidebar = within(screen.getByTestId('sidebar'));
    click(sidebar.getByRole('button', { name: 'Hide panel' }));
    expect(sidebar.queryByRole('button', { name: 'Arrange' })).toBeNull();
    openView();
    expect(row('Arrange')).toHaveAttribute('aria-checked', 'false');
  });
});
