import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider } from '@weasel-js/core';
import { iconsWrapper } from '@weasel-js/ui/testing/withIcons';
import { App } from './App';
import { PIPELINE_STORAGE_KEY } from './pipeline/usePipelineDoc';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) },
  );
});
afterEach(() => {
  cleanup();
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

  it("points pipeline mode's Edit menu at the pipeline's own undo", () => {
    mount();
    choose('Mode', 'Pipeline');
    act(() => { fireEvent.click(within(screen.getByRole('menubar')).getByRole('menuitem', { name: 'Edit' })); });
    const rows = [...screen.getAllByRole('menu').at(-1)!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    // A row's second child is its label; the shortcut follows it.
    expect(rows.map((r) => r.children[1]!.textContent)).toEqual(['Undo', 'Redo', 'Delete']);
  });

  it('gives chart mode a Page menu that adds and deletes pages, and pipeline mode none', () => {
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
    expect(within(screen.getByRole('menubar')).queryByRole('menuitem', { name: 'Page' })).toBeNull();
  });

  it('opens Page Setup on a page from the Page menu', () => {
    mount();
    choose('Page', 'Page Setup');
    expect(screen.getByRole('dialog', { name: /Page Setup: Page 1/ })).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
