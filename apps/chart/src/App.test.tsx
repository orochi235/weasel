import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider } from '@weasel-js/core';
import { iconsWrapper } from '@weasel-js/ui/testing/withIcons';
import { App } from './App';
import { PIPELINE_STORAGE_KEY } from './pipeline/usePipelineDoc';
import { chartPrefs } from './prefs';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) },
  );
});
afterEach(() => {
  cleanup();
  // The store caches what it read, so clearing storage alone would leak prefs into the next test.
  chartPrefs().reset();
  localStorage.clear();
});

const mount = () => render(
  <DepRegistryProvider>
    <ActionsProvider>
      <App />
    </ActionsProvider>
  </DepRegistryProvider>,
  { wrapper: iconsWrapper() },
);

/** Opens a menu-bar menu and clicks the row whose label starts with `row`. */
function choose(menu: string, row: string): void {
  act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: menu })); });
  const open = screen.getAllByRole('menu').at(-1)!;
  const item = [...open.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find((el) => el.textContent?.startsWith(row));
  act(() => { fireEvent.click(item!); });
}

describe('App', () => {
  it('shows the File, Edit and Mode menus and a canvas', () => {
    const { container } = mount();
    for (const name of ['File', 'Edit', 'Mode']) {
      expect(screen.getByRole('menuitem', { name })).toBeTruthy();
    }
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('swaps in the pipeline workspace from Mode › Pipeline, and back', () => {
    mount();
    expect(screen.queryByRole('grid', { name: 'Stages' })).toBeNull();
    choose('Mode', 'Pipeline');
    expect(screen.getByRole('grid', { name: 'Stages' })).toBeTruthy();
    expect(screen.getByText('Select a stage to edit its params.')).toBeTruthy();
    choose('Mode', 'Chart');
    expect(screen.queryByRole('grid', { name: 'Stages' })).toBeNull();
    expect(screen.getByRole('listbox', { name: 'Shapes' })).toBeTruthy();
  });

  it("keeps pipeline mode's undo history through a visit to chart mode", () => {
    mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(screen.getByRole('row', { name: 'Blur' })); });
    const stages = () => (JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!) as { pipeline: { stages: unknown[] } }).pipeline.stages;
    expect(stages()).toHaveLength(1);
    choose('Mode', 'Chart');
    choose('Mode', 'Pipeline');
    choose('Edit', 'Undo');
    expect(stages()).toHaveLength(0);
  });

  it('gives pipeline mode a File menu of its own', () => {
    mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'File' })); });
    const rows = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    expect(rows.map((r) => r.children[1]!.textContent)).toEqual(['New', 'Open…', 'Save']);
  });

  it('gives pipeline mode View › Look, and keeps the look picked through a visit to chart mode', () => {
    mount();
    choose('Mode', 'Pipeline');
    const looks = () => {
      act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'View' })); });
      const look = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
        .find((el) => el.textContent?.startsWith('Look'))!;
      act(() => { fireEvent.click(look); });
      return [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    };
    const held = (rows: HTMLElement[]) => rows.filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.children[1]!.textContent);
    const rows = looks();
    expect(rows.map((r) => r.children[1]!.textContent)).toEqual(['Node graph', 'Rack', 'Lanes']);
    expect(held(rows)).toEqual(['Node graph']);
    act(() => { fireEvent.click(rows[1]!); });
    choose('Mode', 'Chart');
    choose('Mode', 'Pipeline');
    expect(held(looks())).toEqual(['Rack']);
  });

  it('opens Preferences from View in chart mode', () => {
    mount();
    expect(screen.queryByRole('dialog')).toBeNull();
    choose('View', 'Preferences');
    expect(within(screen.getByRole('dialog')).getByText('Show grid')).toBeTruthy();
  });

  it('flips the grid prefs from View in chart mode, each row held while its pref is on', () => {
    mount();
    const rows = () => {
      act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'View' })); });
      return [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    };
    const label = (r: HTMLElement) => r.children[1]!.textContent;
    const first = rows();
    expect(first.map(label)).toEqual(['Show grid', 'Snap to grid', 'Preferences…']);
    act(() => { fireEvent.click(first[0]!); });
    expect(chartPrefs().get('view.gridVisible')).toBe(true);
    choose('View', 'Snap to grid');
    expect(chartPrefs().get('view.snapToGrid')).toBe(true);
    const again = rows();
    expect(again.filter((r) => r.getAttribute('aria-checked') === 'true').map(label)).toEqual(['Show grid', 'Snap to grid']);
    act(() => { fireEvent.click(again[0]!); });
    expect(chartPrefs().get('view.gridVisible')).toBe(false);
  });

  it('opens Preferences from View in pipeline mode', () => {
    mount();
    choose('Mode', 'Pipeline');
    choose('View', 'Preferences');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps the pipeline look across a remount', async () => {
    const first = mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'View' })); });
    const rows = () => [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    act(() => { fireEvent.click(rows().find((el) => el.textContent?.startsWith('Look'))!); });
    act(() => { fireEvent.click(rows().find((el) => el.textContent?.startsWith('Lanes'))!); });
    first.unmount();
    await chartPrefs().flush();
    expect(localStorage.getItem('weaselchart.prefs/pipeline.look')).toContain('lanes');

    mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'View' })); });
    act(() => { fireEvent.click(rows().find((el) => el.textContent?.startsWith('Look'))!); });
    const held = rows().filter((el) => el.getAttribute('aria-checked') === 'true').map((el) => el.children[1]!.textContent);
    expect(held).toEqual(['Lanes']);
  });

  it("points pipeline mode's Edit menu at the pipeline's own undo", () => {
    mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Edit' })); });
    const rows = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    // A row's second child is its label; the shortcut follows it.
    expect(rows.map((r) => r.children[1]!.textContent)).toEqual(['Undo', 'Redo', 'Delete']);
  });
});
