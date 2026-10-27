import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider,
  DepRegistryProvider,
  SceneCanvas,
  actionItems,
  asNodeId,
  createScene,
  PAGES_DOC_KEY,
  pagesOf,
  useActionsRegistry,
  type ActionsRegistry,
} from '@weasel-js/core';
import { CommandPalette } from '@weasel-js/ui/components/CommandPalette';
import type { DrawScene, WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { FILE_ACTIONS, useFileCommands, type FileCommandsTarget } from './fileCommands';
import { importSvgFile, openSvgFile } from './openSvg';
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

function seededScene(): DrawScene {
  const letter = { width: 816, height: 1056 };
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    doc: { [PAGES_DOC_KEY]: { pages: [{ id: 'page-1', ...letter }, { id: 'page-2', ...letter }] } },
  });
  for (const id of ['a', 'b']) {
    scene.add({
      kind: 'mark', layer: 'default', id: asNodeId(id),
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
    backgroundColor: '#ffffff',
    setFilename: vi.fn(),
    showFirstPage: vi.fn(),
    setBackgroundColor: vi.fn(),
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
    act(() => { registry.trigger('file.new', { size: 'a4' }); });
    expect(scene.renderOrder()).toEqual([]);
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 794, height: 1123 }]);
    expect(target.showFirstPage).toHaveBeenCalledOnce();
    act(() => { scene.undo(); });
    expect(scene.renderOrder()).toHaveLength(2);
    expect(pagesOf(scene)?.pages.map((p) => p.id)).toEqual(['page-1', 'page-2']);
  });

  it('New with no size empties the document to one page of the shown paper size', () => {
    const { registry, scene } = setup();
    act(() => { registry.trigger('file.new'); });
    expect(scene.renderOrder()).toEqual([]);
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 816, height: 1056 }]);
  });

  it('Open and Import hand the picker the document', () => {
    const { registry, scene } = setup();
    act(() => { registry.trigger('file.open'); });
    expect(openSvgFile).toHaveBeenCalledWith(expect.objectContaining({ scene }));
    act(() => { registry.trigger('file.import'); });
    expect(importSvgFile).toHaveBeenCalledWith(scene);
  });

  it('Save writes the latest filename, size and background', () => {
    const { registry, scene, target, rerender } = setup();
    rerender({ ...target, filename: 'b' });
    act(() => { registry.trigger('file.save'); });
    expect(saveSvgFile).toHaveBeenCalledWith(scene, { filename: 'b', paperSize: 'letter', backgroundColor: '#ffffff' });
  });

  it('mod+S saves, and keeps the browser from saving the page', () => {
    setup();
    // jsdom is not an Apple platform, so mod is Ctrl.
    const e = new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(e); });
    expect(saveSvgFile).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it('finds the paper sizes in the command palette by typing "new"', () => {
    Element.prototype.scrollIntoView = () => {};
    const scene = seededScene();
    const target = { scene, filename: 'a', paperSize: 'letter', backgroundColor: '#fff', setFilename: vi.fn(), showFirstPage: vi.fn(), setBackgroundColor: vi.fn() } as FileCommandsTarget;
    // The palette snapshots the registry when it opens, so open it after the commands register.
    function Host() {
      useFileCommands(target);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>open</button>
          <CommandPalette open={open} onClose={() => setOpen(false)} />
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
