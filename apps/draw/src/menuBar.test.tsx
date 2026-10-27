import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider,
  BUILTIN_TOOL_IDS,
  DepRegistryProvider,
  SceneCanvas,
  asNodeId,
  createScene,
  useActionsRegistry,
  type ActionsRegistry,
  type ToolsApi,
  pagesOf,
} from '@weasel-js/core';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { appCommandsContribution, type AppCommands } from './appCommands';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { DRAW_FEATURES } from './drawFeatures';
import { useFileCommands } from './fileCommands';
import { DRAW_MENU_BAR } from './menuBar';
import { saveSvgFile } from './saveSvg';
import { withIcons } from './testIcons';

vi.mock('./saveSvg', () => ({ saveSvgFile: vi.fn(async () => {}) }));
vi.mock('./openSvg', () => ({ openSvgFile: vi.fn(async () => {}), importSvgFile: vi.fn(async () => {}) }));

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Mounts what Workspace mounts around the canvas (its features and `claimKeys`), with the bar beside it. */
function setup() {
  const commands: AppCommands = {
    gridVisible: false, toggleGrid: vi.fn(),
    snapToGrid: false, toggleSnap: vi.fn(),
    pathDirection: false, togglePathDirection: vi.fn(),
    symmetryOn: false, toggleSymmetry: vi.fn(),
    canReleaseCompound: false, releaseCompound: vi.fn(),
    openPrefs: vi.fn(), openPalette: vi.fn(),
    chromeHidden: (id: string) => id === 'history', toggleChrome: vi.fn(),
  };
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  scene.add({
    kind: 'mark', layer: 'default', id: asNodeId('a'),
    pose: { x: 0, y: 0, width: 10, height: 10 },
    data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } },
  });
  let registry: ActionsRegistry | null = null;
  let tools: ToolsApi | null = null;
  function Probe() {
    useFileCommands({
      scene, filename: 'a', paperSize: 'letter', backgroundColor: '#ffffff',
      setFilename: vi.fn(), showFirstPage: vi.fn(), setBackgroundColor: vi.fn(),
    });
    registry = useActionsRegistry();
    return null;
  }
  render(
    <DepRegistryProvider>
      <ActionsProvider>
        <Probe />
        <MenuBar schema={DRAW_MENU_BAR} />
        <SceneCanvas<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose> features={DRAW_FEATURES} claimKeys
          scene={scene} layers={{}} width={64} height={64} defaultTools={BUILTIN_TOOL_IDS}
          onToolsCreated={(t) => { tools = t; }}
          ambient={[appCommandsContribution(() => commands)]} />
      </ActionsProvider>
    </DepRegistryProvider>,
    { wrapper: withIcons },
  );
  return {
    commands, scene,
    registry: registry as unknown as ActionsRegistry,
    tools: () => tools as unknown as ToolsApi,
  };
}

const title = (name: string) => within(screen.getByRole('menubar')).getByRole('menuitem', { name });
const open = (name: string) => act(() => { fireEvent.click(title(name)); });
/** The innermost open menu: a submenu is a second `menu` role on top of its parent. A row's accessible name is its label with its shortcut run on after it, so single rows match by prefix. */
const menu = () => within(screen.getAllByRole('menu').at(-1)!);
/** A row's label alone, for ordered lists: its accessible name carries the shortcut after it. */
const labels = () => [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
  .map((r) => r.children[1]!.textContent);

const ROWS = {
  File: ['New', 'Open…', 'Import…', 'Save'],
  Edit: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Duplicate', 'Delete', 'Select All'],
  Arrange: ['Group', 'Ungroup', 'Bring Forward', 'Bring to Front', 'Send Backward', 'Send to Back',
    'Align Left', 'Align Centers Horizontally', 'Align Right', 'Align Top', 'Align Centers Vertically', 'Align Bottom',
    'Distribute Horizontally', 'Distribute Vertically', 'Flip Horizontal', 'Flip Vertical'],
  View: ['Show grid', 'Snap to grid', 'Show path direction', 'Symmetry', 'Zoom In', 'Zoom Out', 'Reset Zoom',
    'Arrange', 'Pathfinder', 'Path', 'Loupe', 'Tools', 'Path tools', 'Properties', 'Colors', 'Layers', 'History',
    'Status bar'],
};

describe('DRAW_MENU_BAR', () => {
  it('has File, Edit, Arrange and View', () => {
    setup();
    expect(within(screen.getByRole('menubar')).getAllByRole('menuitem').map((el) => el.textContent))
      .toEqual(Object.keys(ROWS));
  });

  it.each(Object.entries(ROWS))('lists every row %s names, so no id is misspelled or unregistered', (name, rows) => {
    setup();
    open(name);
    expect(labels()).toEqual(rows);
  });

  it('names only actions the app registers', () => {
    const { registry } = setup();
    const registered = new Set(registry.list().map((a) => a.id));
    const named: string[] = [];
    const walk = (g: PrefGroup) => {
      for (const child of Object.values(g.children)) {
        if (!isPrefLeaf(child)) walk(child);
        else if (child.kind === 'action' && 'action' in child && child.action) named.push(child.action);
      }
    };
    walk(DRAW_MENU_BAR);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((id) => !registered.has(id.split(':')[0]!))).toEqual([]);
  });

  it("opens New's paper sizes as a submenu, and a size starts a document at it", () => {
    const t = setup();
    open('File');
    act(() => { fireEvent.click(menu().getByRole('menuitem', { name: /^New/ })); });
    expect(labels()).toEqual(['US Letter', 'A4', 'Legal']);
    act(() => { fireEvent.click(menu().getByRole('menuitem', { name: 'A4' })); });
    expect(pagesOf(t.scene)?.pages[0]).toMatchObject({ width: 794, height: 1123 });
  });

  it('runs the action a row names', () => {
    const t = setup();
    open('View');
    act(() => { fireEvent.click(menu().getByRole('menuitemcheckbox', { name: /^Show grid/ })); });
    expect(t.commands.toggleGrid).toHaveBeenCalledOnce();
    open('File');
    act(() => { fireEvent.click(menu().getByRole('menuitem', { name: /^Save/ })); });
    expect(saveSvgFile).toHaveBeenCalledOnce();
  });

  it('checks a toolbar or panel row while it shows, and toggles it by id', () => {
    const t = setup();
    open('View');
    expect(menu().getByRole('menuitemcheckbox', { name: /^Layers/ })).toHaveAttribute('aria-checked', 'true');
    expect(menu().getByRole('menuitemcheckbox', { name: /^History/ })).toHaveAttribute('aria-checked', 'false');
    act(() => { fireEvent.click(menu().getByRole('menuitemcheckbox', { name: /^Status bar/ })); });
    expect(t.commands.toggleChrome).toHaveBeenCalledWith('statusBar');
  });

  it('marks a row disabled while its action is', () => {
    setup();
    open('Arrange');
    expect(menu().getByRole('menuitem', { name: /^Group/ })).toHaveAttribute('aria-disabled', 'true');
  });

  // Option+letter as macOS reports it: the typed character, with the physical key in `code`.
  it.each([
    ['File', 'ƒ', 'KeyF'], ['Edit', '´', 'KeyE'], ['Arrange', 'å', 'KeyA'], ['View', '√', 'KeyV'],
  ])('opens %s on its Alt chord while the canvas holds keys, and changes no tool or document', (name, key, code) => {
    const t = setup();
    const before = { active: t.tools().active, engaged: t.tools().hotkeyEngaged, order: [...t.scene.renderOrder()] };
    act(() => { fireEvent.keyDown(document.body, { key, code, altKey: true }); });
    expect({ active: t.tools().active, engaged: t.tools().hotkeyEngaged, order: [...t.scene.renderOrder()] }).toEqual(before);
    expect(labels()).toEqual(ROWS[name as keyof typeof ROWS]);
    expect(t.commands.toggleGrid).not.toHaveBeenCalled();
  });
});
