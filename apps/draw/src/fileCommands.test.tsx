import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionDisabledReason,
  ActionsProvider,
  DepRegistryProvider,
  SceneCanvas,
  actionItems,
  asNodeId,
  pagesOf,
  placedPagesOf,
  useActionsRegistry,
  type ActionsRegistry,
} from '@weasel-js/core';
import { CommandPalette } from '@weasel-js/ui/components/CommandPalette';
import type { DrawScene } from './drawDocument';
import { FILE_ACTIONS, useFileCommands, type FileCommandsTarget } from './fileCommands';
import { importSvgFile, openSvgFile } from './openSvg';
import { contentRoots } from '@weasel-js/core';
import { exportPageSvgFile, saveSvgFile } from './saveSvg';
import { exportPagePngFile, exportPagesPdfFile } from './exportPage';
import { backgroundOf, setBackground } from './docBackground';
import { withIcons } from './testIcons';
import { drawScene } from './testScenes';

vi.mock('./saveSvg', () => ({ saveSvgFile: vi.fn(async () => {}), exportPageSvgFile: vi.fn(async () => {}) }));
vi.mock('./exportPage', () => ({ exportPagePngFile: vi.fn(async () => {}), exportPagesPdfFile: vi.fn(async () => {}) }));
vi.mock('./openSvg', () => ({ openSvgFile: vi.fn(async () => {}), importSvgFile: vi.fn(async () => {}) }));

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function seededScene(): DrawScene {
  const letter = { width: 816, height: 1056 };
  const scene = drawScene([{ id: 'page-1', ...letter }, { id: 'page-2', ...letter }]);
  for (const id of ['a', 'b']) {
    scene.add({
      kind: 'mark', layer: 'default', id: asNodeId(id), parent: asNodeId('page-1'),
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } },
    });
  }
  return scene;
}

function setup() {
  const scene = seededScene();
  const target: FileCommandsTarget = {
    scene,
    filename: 'a',
    paperSize: 'letter',
    page: placedPagesOf(scene)[1]!,
    setFilename: vi.fn(),
    showFirstPage: vi.fn(), leaveMode: vi.fn(),
  };
  let registry: ActionsRegistry | null = null;
  function Probe({ t }: { t: FileCommandsTarget }) {
    useFileCommands(t);
    registry = useActionsRegistry();
    return null;
  }
  const ui = (t: FileCommandsTarget) => (
    <DepRegistryProvider>
      <ActionsProvider>
        <Probe t={t} />
        <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} />
      </ActionsProvider>
    </DepRegistryProvider>
  );
  const view = render(ui(target), { wrapper: withIcons });
  const reg = registry as unknown as ActionsRegistry;
  const get = (id: string) => reg.list().find((a) => a.id === id)!;
  return { scene, target, registry: reg, get, rerender: (t: FileCommandsTarget) => view.rerender(ui(t)) };
}

describe('useFileCommands', () => {
  it('offers New once per paper size', () => {
    const { get } = setup();
    expect(actionItems(get(FILE_ACTIONS.new)).map((i) => [i.key, i.label]))
      .toEqual([['file.new:letter', 'US Letter'], ['file.new:a4', 'A4'], ['file.new:legal', 'Legal']]);
  });

  it('New at a size empties the document to one page of that size, in one undo entry, and shows it', () => {
    const { registry, scene, target } = setup();
    vi.mocked(target.leaveMode).mockImplementation(() => { expect(contentRoots(scene)).toHaveLength(2); });
    act(() => { registry.trigger('file.new', { size: 'a4' }); });
    expect(target.leaveMode).toHaveBeenCalledOnce();
    expect(contentRoots(scene)).toEqual([]);
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 794, height: 1123 }]);
    expect(target.showFirstPage).toHaveBeenCalledOnce();
    expect(target.setFilename).toHaveBeenCalledWith('untitled.svg');
    act(() => { scene.undo(); });
    expect(contentRoots(scene)).toHaveLength(2);
    expect(pagesOf(scene)?.pages.map((p) => p.id)).toEqual(['page-1', 'page-2']);
  });

  it('New resets the background in its own entry: undo puts the old one back and leaves the filename', () => {
    const { registry, scene, target } = setup();
    setBackground(scene, '#336699');
    act(() => { registry.trigger('file.new', { size: 'a4' }); });
    expect(backgroundOf(scene)).toBe('#ffffff');
    expect(target.setFilename).toHaveBeenCalledExactlyOnceWith('untitled.svg');
    act(() => { scene.undo(); });
    expect(backgroundOf(scene)).toBe('#336699');
    expect(contentRoots(scene)).toHaveLength(2);
    expect(target.setFilename).toHaveBeenCalledOnce();
  });

  it('New with no size empties the document to one page of the shown paper size', () => {
    const { registry, scene } = setup();
    act(() => { registry.trigger('file.new'); });
    expect(contentRoots(scene)).toEqual([]);
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 816, height: 1056 }]);
  });

  it('New with no size keeps the shown page\'s size when it is none of the paper sizes', () => {
    const { registry, scene, target, rerender } = setup();
    rerender({ ...target, page: { ...target.page!, width: 420, height: 595 } });
    act(() => { registry.trigger('file.new'); });
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 420, height: 595 }]);
  });

  it('Open and Import hand the picker the document', () => {
    const { registry, scene } = setup();
    act(() => { registry.trigger('file.open'); });
    expect(openSvgFile).toHaveBeenCalledWith(expect.objectContaining({ scene }));
    act(() => { registry.trigger('file.import'); });
    expect(importSvgFile).toHaveBeenCalledWith(scene);
  });

  it("Save writes the latest filename and the document's background", () => {
    const { registry, scene, target, rerender } = setup();
    rerender({ ...target, filename: 'b' });
    setBackground(scene, '#336699');
    act(() => { registry.trigger('file.save'); });
    expect(saveSvgFile).toHaveBeenCalledWith(scene, { filename: 'b', backgroundColor: '#336699' });
  });

  it('Export Page writes the page in view, and nothing with none', () => {
    const { registry, scene, target, rerender } = setup();
    act(() => { registry.trigger('file.exportPage'); });
    expect(exportPageSvgFile).toHaveBeenCalledWith(scene, target.page, { filename: 'a', backgroundColor: '#ffffff' });
    vi.mocked(exportPageSvgFile).mockClear();
    rerender({ ...target, page: null });
    act(() => { registry.trigger('file.exportPage'); });
    expect(exportPageSvgFile).not.toHaveBeenCalled();
  });

  it('Export Page reads as unavailable while there is no page to write, so a menu greys it', () => {
    const { registry, target, rerender } = setup();
    const enabled = () => registry.list().find((a) => a.id === 'file.exportPage')!.enabled?.({}) ?? true;
    expect(enabled()).toBe(true);
    rerender({ ...target, page: null });
    expect(enabled()).toBe(ActionDisabledReason.NotApplicable);
  });

  it('Export Page as PNG writes the page in view on the background, and nothing with none', () => {
    const { registry, scene, target, rerender } = setup();
    setBackground(scene, '#336699');
    act(() => { registry.trigger(FILE_ACTIONS.exportPng); });
    expect(exportPagePngFile).toHaveBeenCalledWith(scene, target.page, { filename: 'a', backgroundColor: '#336699' });
    vi.mocked(exportPagePngFile).mockClear();
    rerender({ ...target, page: null });
    act(() => { registry.trigger(FILE_ACTIONS.exportPng); });
    expect(exportPagePngFile).not.toHaveBeenCalled();
    expect(registry.list().find((a) => a.id === FILE_ACTIONS.exportPng)!.enabled?.({})).toBe(ActionDisabledReason.NotApplicable);
  });

  it('Export Pages as PDF writes every page, whichever is in view', () => {
    const { registry, scene, target, rerender } = setup();
    rerender({ ...target, page: null });
    act(() => { registry.trigger(FILE_ACTIONS.exportPdf); });
    expect(exportPagesPdfFile).toHaveBeenCalledWith(scene, placedPagesOf(scene), { filename: 'a', backgroundColor: '#ffffff' });
    expect(vi.mocked(exportPagesPdfFile).mock.calls[0]![1]).toHaveLength(2);
  });

  it('mod+S saves, and keeps the browser from saving the page', () => {
    setup();
    // jsdom is not an Apple platform, so mod is Ctrl.
    const e = new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(saveSvgFile).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it("mod+O opens draw's picker, and keeps the browser from opening its own", () => {
    setup();
    const e = new KeyboardEvent('keydown', { key: 'o', code: 'KeyO', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(openSvgFile).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it('finds the paper sizes in the command palette by typing "new"', () => {
    Element.prototype.scrollIntoView = () => {};
    const scene = seededScene();
    const target = { scene, filename: 'a', paperSize: 'letter', page: null, setFilename: vi.fn(), showFirstPage: vi.fn(), leaveMode: vi.fn() } as FileCommandsTarget;
    // The palette snapshots the registry when it opens, so open it after the commands register.
    function Host() {
      useFileCommands(target);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>open</button>
          <CommandPalette isOpen={open} onOpenChange={setOpen} />
        </>
      );
    }
    render(
      <DepRegistryProvider>
        <ActionsProvider>
          <Host />
        </ActionsProvider>
      </DepRegistryProvider>,
      { wrapper: withIcons },
    );
    fireEvent.click(screen.getByText('open'));
    fireEvent.change(screen.getByPlaceholderText('Search actions…'), { target: { value: 'new' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('US Letter'), expect.stringContaining('A4'), expect.stringContaining('Legal')]),
    );
  });
});
