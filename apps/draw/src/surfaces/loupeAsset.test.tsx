import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { ActionsProvider } from '@weasel-js/core';
import { ContextMenuHost } from '@weasel-js/ui/components/ContextMenu';
import type { LoupeEvents, LoupeSettings } from '../useLoupe';
import { CommandBar } from '../CommandBar';
import { LoupeProvider } from '../LoupeProvider';
import { drawPrefs } from '../prefs';
import { RightSidebar } from '../RightSidebar';
import { StripDock } from './StripSurfaces';
import type { SidebarHost } from './types';
import { renderWithIcons } from '../testIcons';

// The lens itself needs a live canvas; what is under test is the state the asset drives into it.
const lens = vi.hoisted(() => ({ settings: null as LoupeSettings | null, events: null as LoupeEvents | null }));
vi.mock('../useLoupe', () => ({
  useLoupe: (_ref: unknown, _hud: unknown, _source: unknown, settings: LoupeSettings, events: LoupeEvents) => {
    lens.settings = settings;
    lens.events = events;
  },
}));
vi.mock('@weasel-js/hud/react', () => ({ useHud: () => ({}) }));
vi.mock('../tools/colorContext', () => ({ useColorContext: () => ({ focused: 'fill', setFocusedColor: () => {} }) }));

// Same in-memory Storage shim as prefs.test.ts: jsdom 26 + Node 26 can
// leave `window.localStorage` undefined.
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

function App() {
  return (
    <ActionsProvider>
      <LoupeProvider canvasRef={{ current: null }} ready source={[]}>
        <div data-testid="strip">
          <CommandBar />
          <StripDock />
        </div>
        <div data-testid="sidebar">
          <RightSidebar {...({} as SidebarHost)} />
        </div>
        <ContextMenuHost />
      </LoupeProvider>
    </ActionsProvider>
  );
}

const strip = () => within(screen.getByTestId('strip'));
const sidebar = () => within(screen.getByTestId('sidebar'));
const loupeBar = () => within(strip().getByRole('toolbar', { name: 'Loupe' }));
const click = (el: Element) => act(() => { fireEvent.click(el); });

beforeEach(() => {
  drawPrefs().reset();
  lens.settings = null;
  lens.events = null;
  // The code-drawn panels read a document this test has none of.
  drawPrefs().set('ui.surfaces', {
    properties: { hidden: true }, colors: { hidden: true }, layers: { hidden: true }, history: { hidden: true },
  });
});
afterEach(cleanup);

describe('the loupe asset', () => {
  it('draws as a toolbar holding only its switch while the loupe is off', () => {
    renderWithIcons(<App />);
    expect(loupeBar().getByRole('switch', { name: 'Loupe' })).not.toBeChecked();
    expect(loupeBar().queryByRole('spinbutton', { name: 'Magnification' })).toBeNull();
    expect(lens.settings).toEqual({ visible: false, mode: 'vector', factor: 8 });
  });

  it('drives the lens from its switch, mode, and magnification', () => {
    renderWithIcons(<App />);
    click(loupeBar().getByRole('switch', { name: 'Loupe' }));
    expect(lens.settings?.visible).toBe(true);

    click(loupeBar().getByRole('radio', { name: 'Pixel' }));
    expect(lens.settings?.mode).toBe('pixel');

    const factor = loupeBar().getByRole('spinbutton', { name: 'Magnification' });
    act(() => {
      fireEvent.change(factor, { target: { value: '12' } });
      fireEvent.blur(factor);
    });
    expect(lens.settings?.factor).toBe(12);
  });

  it('shows the color under the lens and copies it', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderWithIcons(<App />);
    click(loupeBar().getByRole('switch', { name: 'Loupe' }));
    expect(loupeBar().getByRole('button', { name: 'Copy' })).toHaveAttribute('aria-disabled', 'true');

    act(() => { lens.events!.onColorChange('#336699'); });
    expect(loupeBar().getByRole('status', { name: 'Color' }).textContent).toBe('#336699');
    click(loupeBar().getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('#336699');
  });

  it('turns its switch off when the lens is closed from its own chrome', () => {
    renderWithIcons(<App />);
    click(loupeBar().getByRole('switch', { name: 'Loupe' }));
    act(() => { lens.events!.onClose(); });
    expect(loupeBar().getByRole('switch', { name: 'Loupe' })).not.toBeChecked();
    expect(lens.settings?.visible).toBe(false);
  });

  it('stays bound as a panel and as a menu', () => {
    renderWithIcons(<App />);
    act(() => { drawPrefs().set('ui.surfaces', { ...drawPrefs().get('ui.surfaces'), loupe: { surface: 'panel' } }); });
    expect(strip().queryByRole('toolbar', { name: 'Loupe' })).toBeNull();
    click(sidebar().getByRole('switch', { name: 'Loupe' }));
    expect(lens.settings?.visible).toBe(true);
    click(sidebar().getByRole('radio', { name: 'Pixel' }));
    expect(lens.settings?.mode).toBe('pixel');

    act(() => { drawPrefs().set('ui.surfaces', { ...drawPrefs().get('ui.surfaces'), loupe: { surface: 'menu' } }); });
    click(strip().getByRole('button', { name: 'Loupe' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Loupe' })).toHaveAttribute('aria-checked', 'true');
    click(screen.getByRole('menuitemcheckbox', { name: 'Vector' }));
    expect(lens.settings?.mode).toBe('vector');
  });

  it('keeps its magnification and color as a menu, the magnification edited without closing it', () => {
    renderWithIcons(<App />);
    click(loupeBar().getByRole('switch', { name: 'Loupe' }));
    act(() => { lens.events!.onColorChange('#336699'); });
    act(() => { drawPrefs().set('ui.surfaces', { ...drawPrefs().get('ui.surfaces'), loupe: { surface: 'menu' } }); });
    click(strip().getByRole('button', { name: 'Loupe' }));

    const factor = screen.getByRole('spinbutton', { name: 'Magnification' });
    expect(screen.getByRole('menuitem', { name: /Magnification/ })).toContainElement(factor);
    expect(factor).toHaveValue('8');
    act(() => {
      fireEvent.change(factor, { target: { value: '12' } });
      fireEvent.blur(factor);
    });
    expect(lens.settings?.factor).toBe(12);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(factor).toHaveValue('12');

    expect(screen.getByRole('menuitem', { name: /^Color\s*#336699$/ })).toHaveAttribute('aria-disabled', 'true');
  });
});
