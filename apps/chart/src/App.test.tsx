import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider } from '@weasel-js/core';
import { DIAGRAM_TYPES } from '@weasel-js/diagram';
import { App } from './App';
import { PIPELINE_STORAGE_KEY } from './pipeline/usePipelineDoc';
import { chartPrefs } from './prefs';
import { withIcons } from './testIcons';

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
  { wrapper: withIcons },
);

/** Opens a menu-bar menu and clicks the row whose label starts with `row`. */
function choose(menu: string, ...rows: string[]): void {
  act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: menu })); });
  for (const row of rows) {
    const open = screen.getAllByRole('menu').at(-1)!;
    const item = [...open.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find((el) => el.textContent?.startsWith(row));
    act(() => { fireEvent.click(item!); });
  }
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
    expect(screen.getByRole('toolbar', { name: 'Flowchart' })).toBeTruthy();
  });

  it("keeps pipeline mode's undo history through a visit to chart mode", async () => {
    mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(screen.getByRole('row', { name: 'Blur' })); });
    const stages = () => (JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY) ?? '{"pipeline":{"stages":[]}}') as { pipeline: { stages: unknown[] } }).pipeline.stages;
    await vi.waitFor(() => expect(stages()).toHaveLength(1));
    choose('Mode', 'Chart');
    choose('Mode', 'Pipeline');
    choose('Edit', 'Undo');
    await vi.waitFor(() => expect(stages()).toHaveLength(0));
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

  it('turns the rack down a column from View › Rack Direction, which only Rack enables', () => {
    mount();
    choose('Mode', 'Pipeline');
    const directions = () => {
      act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'View' })); });
      const sub = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
        .find((el) => el.textContent?.startsWith('Rack Direction'))!;
      act(() => { fireEvent.click(sub); });
      return [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    };
    const off = directions();
    expect(off.map((r) => r.children[1]!.textContent)).toEqual(['Across', 'Down']);
    expect(off.every((r) => r.getAttribute('aria-disabled') === 'true')).toBe(true);
    cleanup();
    chartPrefs().set('pipeline.look', 'rack');
    mount();
    choose('Mode', 'Pipeline');
    const on = directions();
    expect(on.map((r) => r.getAttribute('aria-disabled'))).not.toContain('true');
    act(() => { fireEvent.click(on[1]!); });
    expect(chartPrefs().get('pipeline.rackDirection')).toBe('down');
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

  it("flips the grid prefs from Photoshop's keys, Mod+' and Mod+Shift+;, and shows them in View", () => {
    mount();
    // jsdom is not an Apple platform, so mod is Ctrl. Shift makes the ; key type ':'.
    const press = (init: KeyboardEventInit) => {
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { ...init, ctrlKey: true, bubbles: true, cancelable: true })); });
    };
    press({ key: "'", code: 'Quote' });
    expect(chartPrefs().get('view.gridVisible')).toBe(true);
    press({ key: ':', code: 'Semicolon', shiftKey: true });
    expect(chartPrefs().get('view.snapToGrid')).toBe(true);
    press({ key: "'", code: 'Quote' });
    expect(chartPrefs().get('view.gridVisible')).toBe(false);
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'View' })); });
    const rows = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const shown = (r: HTMLElement) => [...r.children].slice(1).map((c) => c.textContent).join(' ');
    expect(rows.slice(0, 2).map(shown)).toEqual(["Show grid Ctrl+'", 'Snap to grid Ctrl+Shift+;']);
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

  it('gives pipeline mode Format › Connector › Reset route', () => {
    mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Format' })); });
    const connector = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
      .find((el) => el.textContent?.startsWith('Connector'))!;
    act(() => { fireEvent.click(connector); });
    const rows = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    expect(rows.map((r) => r.children[1]!.textContent)).toEqual(['Reset route']);
  });

  it("points pipeline mode's Edit menu at the pipeline's own undo", () => {
    mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Edit' })); });
    const rows = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    // A row's second child is its label; the shortcut follows it.
    expect(rows.map((r) => r.children[1]!.textContent)).toEqual(['Undo', 'Redo', 'Delete']);
  });

  it('gives chart and pipeline modes a Page menu offering Add Page and Delete Page', () => {
    mount();
    const tabs = () => screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs()).toEqual(['Page 1']);
    choose('Page', 'Add Page');
    expect(tabs()).toEqual(['Page 1', 'Page 2']);
    choose('Page', 'Delete Page');
    expect(tabs()).toHaveLength(1);
    choose('Edit', 'Undo');
    expect(tabs()).toHaveLength(2);
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Page' })); });
    const rows = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const labels = rows.map((r) => r.textContent ?? '');
    expect(labels.some((l) => l.startsWith('Add Page'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Delete Page'))).toBe(true);
  });

  it('picks a theme from Format › Theme, holding the one in use, and undoes it in one step', () => {
    mount();
    const themes = () => {
      act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Format' })); });
      const theme = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
        .find((el) => el.textContent?.startsWith('Theme'))!;
      act(() => { fireEvent.click(theme); });
      return [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    };
    const held = (rows: HTMLElement[]) => rows.filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.children[1]!.textContent);
    const rows = themes();
    expect(rows.map((r) => r.children[1]!.textContent)).toEqual([
      'Paper', 'Night', 'Blueprint', 'Pastel', 'Mono', 'Edit Theme…', 'Import Theme…', 'Export Theme…',
    ]);
    expect(held(rows)).toEqual(['Paper']);
    act(() => { fireEvent.click(rows[1]!); });
    expect(held(themes())).toEqual(['Night']);
    act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
    choose('Edit', 'Undo');
    expect(held(themes())).toEqual(['Paper']);
  });

  it('opens the Theme panel in the Format sidebar from Format › Theme › Edit Theme…', () => {
    mount();
    const format = screen.getByRole('complementary', { name: 'Format' });
    expect(within(format).queryByRole('heading', { name: 'Theme' })).toBeNull();
    choose('Format', 'Theme', 'Edit Theme…');
    expect(within(format).getByRole('heading', { name: 'Theme' })).toBeTruthy();
    act(() => { fireEvent.click(within(format).getByRole('button', { name: 'Close theme' })); });
    expect(within(format).queryByRole('heading', { name: 'Theme' })).toBeNull();
  });

  it('gives chart mode a Format sidebar with the Style panel', () => {
    mount();
    const format = screen.getByRole('complementary', { name: 'Format' });
    expect(within(format).getByText('Select shapes or connectors to style them.')).toBeTruthy();
  });

  it('starts a new chart of the type picked in File › New…, and leaves the chart alone on Cancel', () => {
    mount();
    const panels = () => [...document.querySelectorAll('[role="toolbar"]')].map((t) => t.getAttribute('aria-label')).filter((n) => n !== null);
    fireEvent.click(screen.getByRole('button', { name: /More shapes/ }), { detail: 1 });
    act(() => { fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Flowchart/ })); });
    expect(panels()).not.toContain('Flowchart');
    choose('File', 'New…');
    const dialog = screen.getByRole('dialog', { name: 'New Chart' });
    expect(within(dialog).getAllByRole('option').map((o) => o.textContent)).toEqual(Object.values(DIAGRAM_TYPES).map((t) => t.label));
    act(() => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(panels()).not.toContain('Flowchart');
    choose('File', 'New…');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(panels()).toEqual(expect.arrayContaining(['Flowchart', 'Containers']));
  });

  it("offers Arrange › Auto layout, off for a flowchart, which has no layout", () => {
    mount();
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Arrange' })); });
    const row = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
      .find((el) => el.textContent?.startsWith('Auto layout'));
    expect(row?.getAttribute('aria-disabled')).toBe('true');
  });

  it('turns Arrange › Auto layout on for a new org chart or mind map, whose types have a layout', () => {
    mount();
    const autoLayoutOff = () => {
      act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Arrange' })); });
      const row = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
        .find((el) => el.textContent?.startsWith('Auto layout'));
      const off = row?.getAttribute('aria-disabled');
      act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
      return off;
    };
    for (const label of ['Org chart', 'Mind map']) {
      choose('File', 'New…');
      act(() => { fireEvent.click(within(screen.getByRole('dialog', { name: 'New Chart' })).getByRole('option', { name: new RegExp(label) })); });
      act(() => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
      expect(autoLayoutOff()).not.toBe('true');
    }
  });

  it('opens Page Setup on a page from the Page menu', () => {
    mount();
    choose('Page', 'Page Setup');
    expect(screen.getByRole('dialog', { name: /Page Setup: Page 1/ })).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
