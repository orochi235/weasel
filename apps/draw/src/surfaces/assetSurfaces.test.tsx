import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { ActionsProvider, createMeasurements, createScene, useSelection, type Action } from '@weasel-js/core';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';
import { ContextMenuHost } from '@weasel-js/ui/components/ContextMenu';
import { CommandBar } from '../CommandBar';
import { ANNOTATION_LAYER, DRAW_LAYERS, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from '../drawDocument';
import { drawPrefs } from '../prefs';
import { RightSidebar } from '../RightSidebar';
import { renderWithIcons } from '../testIcons';
import { ColorContextProvider } from '../tools/colorContext';
import { SurfaceHostContext } from './hostContext';
import { StripDock } from './StripSurfaces';
import type { SidebarHost } from './types';

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
  { id: 'copy', label: 'Copy', group: 'clipboard', invoker: { timing: 'immediate', run: () => {} } },
];

const setFilename = vi.fn();

function App({ docSelected = false }: { docSelected?: boolean }) {
  const [scene] = useState(() => createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: DRAW_LAYERS }));
  const selection = useSelection({ mode: 'multi', scene });
  const [measurements] = useState(() => createMeasurements({ layer: ANNOTATION_LAYER }));
  const host: SidebarHost = {
    scene, selection, measurements, filename: 'drawing', setFilename, backgroundColor: '#ffffff',
    setBackgroundColor: () => {}, paperSize: 'a4', setPaperSize: () => {}, docSelected, setDocSelected: () => {},
  };
  return (
    <ActionsProvider>
      <ColorContextProvider>
        <SurfaceHostContext.Provider value={host}>
          <RegisterActions actions={ACTIONS} />
          <div data-testid="strip"><CommandBar /><StripDock /></div>
          <div data-testid="sidebar"><RightSidebar /></div>
          <ContextMenuHost />
        </SurfaceHostContext.Provider>
      </ColorContextProvider>
    </ActionsProvider>
  );
}

const strip = () => within(screen.getByTestId('strip'));
const sidebar = () => within(screen.getByTestId('sidebar'));
const click = (el: Element) => act(() => { fireEvent.click(el); });
const surfaces = (patch: object) => drawPrefs().set('ui.surfaces', { ...drawPrefs().get('ui.surfaces'), ...patch });

beforeEach(() => drawPrefs().reset());
afterEach(cleanup);

describe('a command-row asset', () => {
  it('draws in the command row, and moves to a menu button and to a panel from its context menu', () => {
    renderWithIcons(<App />);
    const bar = strip().getByRole('toolbar', { name: 'clipboard actions' });
    act(() => { fireEvent.contextMenu(within(bar).getByRole('button', { name: 'Copy' })); });
    click(screen.getByRole('menuitem', { name: 'Show as menu' }));

    expect(strip().queryByRole('toolbar', { name: 'clipboard actions' })).toBeNull();
    click(strip().getByRole('button', { name: 'Clipboard' }));
    click(screen.getByRole('menuitem', { name: 'Show as panel' }));

    expect(sidebar().getByRole('button', { name: 'Clipboard', expanded: true })).toBeDefined();
    expect(sidebar().getByRole('button', { name: 'Copy' })).toBeDefined();
  });
});

describe('the Properties asset', () => {
  it('shows the selection while no document row is picked', () => {
    renderWithIcons(<App />);
    expect(sidebar().getByRole('button', { name: 'Properties', expanded: true })).toBeDefined();
    expect(sidebar().getByText('No selection')).toBeDefined();
    expect(sidebar().queryByRole('textbox', { name: 'File' })).toBeNull();
  });

  it('shows and edits the document while its row is picked', () => {
    renderWithIcons(<App docSelected />);
    expect(sidebar().getByRole('button', { name: 'Document', expanded: true })).toBeDefined();
    expect(sidebar().queryByText('No selection')).toBeNull();
    const file = sidebar().getByRole('textbox', { name: 'File' });
    expect(file).toHaveValue('drawing');
    expect(file).toHaveAttribute('placeholder', 'untitled.svg');
    act(() => {
      fireEvent.change(file, { target: { value: 'poster' } });
      fireEvent.blur(file);
    });
    expect(setFilename).toHaveBeenCalledWith('poster');
  });
});

describe('the Colors, Layers, and History assets', () => {
  it.each(['Colors', 'Layers', 'History'])('draw %s as a toolbar button opening what the panel shows', (name) => {
    surfaces({ properties: { hidden: true }, [name.toLowerCase()]: { surface: 'bar' } });
    renderWithIcons(<App />);
    expect(sidebar().queryByRole('button', { name, expanded: true })).toBeNull();
    const bar = strip().getByRole('toolbar', { name });
    expect(within(bar).getByRole('button', { name })).toBeDefined();
  });

  it('draw the palette in its panel', () => {
    surfaces({ properties: { hidden: true } });
    renderWithIcons(<App />);
    expect(sidebar().getByRole('button', { name: 'Colors', expanded: true })).toBeDefined();
    expect(sidebar().getAllByLabelText(/Palette/).length).toBeGreaterThan(0);
  });
});
