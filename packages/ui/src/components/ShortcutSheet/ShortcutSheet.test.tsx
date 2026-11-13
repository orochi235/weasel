import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import {
  SELECT_TOOLS, SHAPE_TOOLS, SceneCanvas, WeaselProvider, createScene, key, toolIdsOf, useCommand,
  type BindingOverrides, type ToolsApi,
} from '@weasel-js/core';
import { renderWithIcons } from '../../testing/withIcons';
import { ShortcutSheet } from './ShortcutSheet';
import { useShortcutSheetCommand } from './shortcutSheetCommand';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

const noop = () => {};

function Commands({ open }: { open: () => void }) {
  useShortcutSheetCommand(open);
  useCommand('doc.export', 'Export', noop, { group: 'file', keys: { spec: { kind: 'key', key: 'e', mods: { mod: true } }, opts: { id: 'doc.export.key' } } });
  return null;
}

function setup(initial: BindingOverrides = {}, initiallyOpen = true) {
  const scene = createScene({ systemLayers: [{ id: 'main' }] });
  let rebind!: (next: BindingOverrides) => void;
  function App() {
    const [tools, setTools] = useState<ToolsApi | null>(null);
    const [overrides, setOverrides] = useState(initial);
    const [open, setOpen] = useState(initiallyOpen);
    rebind = setOverrides;
    return (
      <WeaselProvider>
        <Commands open={() => setOpen(true)} />
        <ShortcutSheet isOpen={open} onOpenChange={setOpen} tools={tools} toolSets={[SELECT_TOOLS, SHAPE_TOOLS]} apple={false} />
        <SceneCanvas features={['draw']} scene={scene} width={64} height={64} defaultTools={[SELECT_TOOLS, SHAPE_TOOLS]}
          bindingOverrides={overrides} onToolsCreated={setTools} />
      </WeaselProvider>
    );
  }
  renderWithIcons(<App />);
  giveKeys();
  return { rebind: (next: BindingOverrides) => act(() => rebind(next)) };
}

const group = (name: string) => screen.getByRole('region', { name });
const row = (name: RegExp) => screen.getAllByRole('listitem').find((li) => name.test(li.textContent ?? ''))!;
const search = (text: string) => fireEvent.change(screen.getByRole('searchbox', { name: 'Search shortcuts' }), { target: { value: text } });

describe('ShortcutSheet', () => {
  it('lists every tool in a tool set under the set\'s label', () => {
    setup();
    const shapes = within(group('Shapes'));
    for (const id of toolIdsOf([SHAPE_TOOLS])) {
      expect(shapes.getAllByRole('listitem').some((li) => li.textContent?.toLowerCase().includes(id.slice(0, 4)))).toBe(true);
    }
    expect(shapes.getAllByRole('listitem')).toHaveLength(toolIdsOf([SHAPE_TOOLS]).length);
    expect(within(group('Select')).getAllByRole('listitem')[0]).toHaveTextContent(/^Select/);
  });

  it('shows a rebound key and drops an unbound one, for a tool and for a command', () => {
    const t = setup({ 'tool.activate.rect': key('Q') });
    expect(row(/^Rectangle/).textContent).toBe('RectangleQ');
    expect(row(/^Export/).textContent).toBe('ExportCtrlE');
    t.rebind({ 'tool.activate.rect': key('Shift+K'), 'doc.export.key': key('Mod+Shift+E') });
    expect(row(/^Rectangle/).textContent).toBe('RectangleShiftK');
    expect(row(/^Export/).textContent).toBe('ExportCtrlShiftE');
    t.rebind({ 'tool.activate.rect': null, 'doc.export.key': null });
    expect(row(/^Rectangle/).textContent).toBe('RectangleNo key');
    expect(screen.queryByText('Export')).toBeNull();
  });

  it('opens on its key, through the dispatcher', () => {
    setup({}, false);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true, bubbles: true })); });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy();
    expect(row(/^Keyboard shortcuts/).textContent).toBe('Keyboard shortcutsShift/');
  });

  it('finds a row by its name and by its key, written either way', () => {
    setup({ 'tool.activate.rect': key('Shift+K') });
    search('rect');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['RectangleShiftK']);
    search('shift+k');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['RectangleShiftK']);
    search('Ctrl E');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['ExportCtrlE']);
    search('zzz');
    expect(screen.getByText('No matching shortcuts.')).toBeTruthy();
  });
});
