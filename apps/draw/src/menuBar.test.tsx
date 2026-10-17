import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider,
  DepRegistryProvider,
  SceneCanvas,
  createScene,
  useActionsRegistry,
  type ActionsRegistry,
} from '@weasel-js/core';
import { pathTools } from '@weasel-js/path-tools';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { MenuBar } from '@weasel-js/ui';
import { appCommandsContribution, type AppCommands } from './appCommands';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { useFileCommands } from './fileCommands';
import { DRAW_MENU_BAR } from './menuBar';
import { saveSvgFile } from './saveSvg';

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

function setup() {
  const commands: AppCommands = {
    gridVisible: false, toggleGrid: vi.fn(),
    snapToGrid: false, toggleSnap: vi.fn(),
    pathDirection: false, togglePathDirection: vi.fn(),
    symmetryOn: false, toggleSymmetry: vi.fn(),
    canReleaseCompound: false, releaseCompound: vi.fn(),
    openPrefs: vi.fn(), openPalette: vi.fn(),
  };
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  const setPaperSize = vi.fn();
  let registry: ActionsRegistry | null = null;
  function Probe() {
    useFileCommands({
      scene, filename: 'a', paperSize: 'letter', backgroundColor: '#ffffff',
      setFilename: vi.fn(), setPaperSize, setBackgroundColor: vi.fn(),
    });
    registry = useActionsRegistry();
    return null;
  }
  render(
    <DepRegistryProvider>
      <ActionsProvider>
        <Probe />
        <MenuBar schema={DRAW_MENU_BAR} />
        <SceneCanvas<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose> features={['draw', pathTools]}
          scene={scene} layers={{}} width={64} height={64}
          ambient={[appCommandsContribution(() => commands)]} />
      </ActionsProvider>
    </DepRegistryProvider>,
  );
  return { commands, setPaperSize, registry: registry as unknown as ActionsRegistry };
}

const title = (name: string) => within(screen.getByRole('menubar')).getByRole('menuitem', { name });
const open = (name: string) => act(() => { fireEvent.click(title(name)); });
const menuRows = () => [...document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"], [role="menu"] [role="menuitemcheckbox"]')];
/** A row's label alone: the second child, after the icon and before any shortcut. */
const labelOf = (row: HTMLElement) => row.children[1]!.textContent;
const rowsOf = (name: string) => {
  open(name);
  const rows = menuRows().map(labelOf);
  act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
  cleanup();
  return rows;
};
const row = (name: string) => menuRows().find((r) => labelOf(r) === name)!;

describe('DRAW_MENU_BAR', () => {
  it('has File, Edit, Arrange and View', () => {
    setup();
    expect(within(screen.getByRole('menubar')).getAllByRole('menuitem').map((el) => el.textContent))
      .toEqual(['File', 'Edit', 'Arrange', 'View']);
  });

  it('lists every row it names, so no id is misspelled or unregistered', () => {
    const t = () => setup();
    const rows = (name: string) => { t(); return rowsOf(name); };
    expect(rows('File')).toEqual(['New', 'Open…', 'Import…', 'Save']);
    expect(rows('Edit')).toEqual(['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Duplicate', 'Delete', 'Select All']);
    expect(rows('Arrange')).toEqual(['Group', 'Ungroup', 'Bring Forward', 'Bring to Front', 'Send Backward', 'Send to Back',
      'Align Left', 'Align Centers Horizontally', 'Align Right', 'Align Top', 'Align Centers Vertically', 'Align Bottom',
      'Distribute Horizontally', 'Distribute Vertically', 'Flip Horizontal', 'Flip Vertical']);
    expect(rows('View')).toEqual(['Show grid', 'Snap to grid', 'Show path direction', 'Symmetry', 'Zoom In', 'Zoom Out', 'Reset Zoom']);
  });

  it('names only actions the app registers', () => {
    const { registry } = setup();
    const registered = new Set(registry.list().map((a) => a.id));
    const named: string[] = [];
    const walk = (g: PrefGroup) => {
      for (const child of Object.values(g.children)) {
        if ('children' in child) walk(child as PrefGroup);
        else if ((child as PrefLeaf).kind === 'action') named.push(((child as PrefLeaf & { action: string }).action));
      }
    };
    walk(DRAW_MENU_BAR);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((id) => !registered.has(id.split(':')[0]!))).toEqual([]);
  });

  it("opens New's paper sizes as a submenu, and a size starts a document at it", () => {
    const t = setup();
    open('File');
    act(() => { fireEvent.click(row('New')); });
    expect(menuRows().map(labelOf)).toEqual(expect.arrayContaining(['US Letter', 'A4', 'Legal']));
    act(() => { fireEvent.click(row('A4')); });
    expect(t.setPaperSize).toHaveBeenCalledWith('a4');
  });

  it('runs the action a row names', () => {
    const t = setup();
    open('View');
    act(() => { fireEvent.click(row('Show grid')); });
    expect(t.commands.toggleGrid).toHaveBeenCalledOnce();
    open('File');
    act(() => { fireEvent.click(row('Save')); });
    expect(saveSvgFile).toHaveBeenCalledOnce();
  });

  it('marks a row disabled while its action is', () => {
    setup();
    open('Arrange');
    expect(row('Group').getAttribute('aria-disabled')).toBe('true');
  });

  it('opens File on Alt+F while the canvas holds keys, and fires nothing else', () => {
    const t = setup();
    act(() => { fireEvent.keyDown(window, { key: 'f', code: 'KeyF', altKey: true }); });
    expect(menuRows().map(labelOf)).toEqual(['New', 'Open…', 'Import…', 'Save']);
    expect(t.commands.toggleGrid).not.toHaveBeenCalled();
    expect(saveSvgFile).not.toHaveBeenCalled();
  });
});
