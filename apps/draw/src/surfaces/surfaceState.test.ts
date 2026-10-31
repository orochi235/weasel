import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest';
import { createMemoryAdapter } from '@weasel-js/storage';
import { renderHook, act } from '@testing-library/react';
import { drawPrefs, openDrawPrefs } from '../prefs';
import { SURFACE_ASSETS } from './assets';
import { migrateLegacyPanelFlags, surfaceOf, useSetSurface, useSurfaces } from './surfaceState';
import type { SurfaceAsset } from './types';

const asset = (id: string): SurfaceAsset => SURFACE_ASSETS.find((a) => a.id === id)!;

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

describe('SURFACE_ASSETS', () => {
  it('lists the command row, then Arrange, Pathfinder, and Path as toolbars, Constraints as a menu, Loupe as a toolbar, then the four sidebar panels', () => {
    expect(SURFACE_ASSETS.filter((a) => a.row === 'command').map((a) => a.id)).toEqual([
      'file', 'undo', 'clipboard', 'edit', 'structure', 'view', 'pathCommands', 'corners', 'text', 'compound', 'record', 'app',
    ]);
    expect(SURFACE_ASSETS.filter((a) => a.row !== 'command').map((a) => [a.id, a.defaultSurface])).toEqual([
      ['arrange', 'bar'], ['pathfinder', 'bar'], ['path', 'bar'], ['constraints', 'menu'], ['loupe', 'bar'],
      ['properties', 'panel'], ['colors', 'panel'], ['layers', 'panel'], ['history', 'panel'],
    ]);
  });

  it('draws each schema asset from actions leaves, one run per registry group', () => {
    const groups = (id: string) => {
      const a = asset(id);
      return Object.values(a.schema.children).map((run) => ('children' in run ? (run.children.actions as { group: string }).group : null));
    };
    expect(groups('arrange')).toEqual(['reorder', 'align', 'distribute', 'flip']);
    expect(groups('pathfinder')).toEqual(['pathfinder']);
    expect(groups('path')).toEqual(['path', 'anchors', 'pathEffects']);
  });

  it('lets an asset of built-in leaves go on any surface, and one with its own kinds only where they draw', () => {
    const own = (a: SurfaceAsset) => Object.keys(a.renderers?.panel ?? {});
    for (const a of SURFACE_ASSETS) {
      expect(a.surfaces).toContain(a.defaultSurface);
      if (own(a).length === 0) expect(a.surfaces).toEqual(['bar', 'panel', 'menu']);
      else expect(a.surfaces).not.toContain('menu');
      if (a.surfaces.includes('bar')) for (const kind of own(a)) expect(a.renderers?.bar?.[kind]).toBeDefined();
    }
    expect(asset('properties').surfaces).toEqual(['panel']);
  });
});

describe('surfaceOf', () => {
  it('takes the chosen surface, and the default for none or one the asset does not allow', () => {
    expect(surfaceOf(asset('path'), { surface: 'menu' })).toBe('menu');
    expect(surfaceOf(asset('path'), undefined)).toBe('bar');
    expect(surfaceOf(asset('properties'), { surface: 'bar' })).toBe('panel');
  });
});

describe('useSurfaces', () => {
  beforeEach(() => {
    drawPrefs().reset();
    window.localStorage.clear();
  });

  const layersOf = (all: ReturnType<typeof useSurfaces>) => all.find((b) => b.asset.id === 'layers')!;

  it('toggles collapsed and hides through ui.surfaces', () => {
    const { result } = renderHook(() => layersOf(useSurfaces()));
    expect(result.current.chrome).toMatchObject({ hidden: false, collapsed: false });
    act(() => { result.current.chrome.onToggleCollapse(); });
    expect(result.current.chrome.collapsed).toBe(true);
    act(() => { result.current.chrome.onHide(); });
    expect(result.current.chrome.hidden).toBe(true);
    expect(drawPrefs().get('ui.surfaces')).toEqual({ layers: { collapsed: true, hidden: true } });
  });

  it('keeps assets independent', () => {
    const { result } = renderHook(() => useSurfaces());
    act(() => { layersOf(result.current).chrome.onToggleCollapse(); });
    expect(result.current.find((b) => b.asset.id === 'history')!.chrome.collapsed).toBe(false);
    expect(layersOf(result.current).chrome.collapsed).toBe(true);
  });

  it('moves an asset to another surface, showing it again, and keeps its other flags', () => {
    drawPrefs().set('ui.surfaces', { path: { hidden: true, collapsed: true } });
    const { result } = renderHook(() => ({ all: useSurfaces(), set: useSetSurface() }));
    act(() => { result.current.set('path', 'panel'); });
    const path = result.current.all.find((b) => b.asset.id === 'path')!;
    expect(path.surface).toBe('panel');
    expect(path.chrome).toMatchObject({ hidden: false, collapsed: true });
  });

  it('writes a reorder to ui.surfaces[id].order and leaves surface, hidden and collapsed alone', () => {
    drawPrefs().set('ui.surfaces', { path: { surface: 'menu', hidden: true, collapsed: true } });
    const { result } = renderHook(() => useSurfaces());
    const pathOf = () => result.current.find((b) => b.asset.id === 'path')!;
    act(() => { pathOf().onReorder({ '': ['anchors', 'path'] }); });
    expect(drawPrefs().get('ui.surfaces').path).toEqual({
      surface: 'menu', hidden: true, collapsed: true, order: { '': ['anchors', 'path'] },
    });
    expect(pathOf().order).toEqual({ '': ['anchors', 'path'] });
  });
});

describe('migrateLegacyPanelFlags', () => {
  beforeEach(() => {
    drawPrefs().reset();
    window.localStorage.clear();
  });

  it('folds wd:panel:*:collapsed into ui.surfaces and removes the old keys', async () => {
    window.localStorage.setItem('wd:panel:layers:collapsed', '1');
    window.localStorage.setItem('wd:panel:history:collapsed', '0');
    migrateLegacyPanelFlags(drawPrefs(), window.localStorage);
    expect(drawPrefs().get('ui.surfaces')).toEqual({
      layers: { collapsed: true },
      history: { collapsed: false },
    });
    await vi.waitFor(() => expect(window.localStorage.getItem('wd:panel:layers:collapsed')).toBeNull());
    expect(window.localStorage.getItem('wd:panel:history:collapsed')).toBeNull();
  });

  it('keeps the old keys while the folded value has not reached storage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = { ...createMemoryAdapter(), set: () => Promise.reject(new Error('quota')) };
    const prefs = openDrawPrefs(failing);
    window.localStorage.setItem('wd:panel:layers:collapsed', '1');
    migrateLegacyPanelFlags(prefs, window.localStorage);
    expect(prefs.get('ui.surfaces')).toEqual({ layers: { collapsed: true } });
    expect(await prefs.flush()).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(window.localStorage.getItem('wd:panel:layers:collapsed')).toBe('1');
    await prefs.close();
    warn.mockRestore();
  });

  it('does not overwrite a value already in ui.surfaces', () => {
    drawPrefs().set('ui.surfaces', { layers: { collapsed: false } });
    window.localStorage.setItem('wd:panel:layers:collapsed', '1');
    migrateLegacyPanelFlags(drawPrefs(), window.localStorage);
    expect(drawPrefs().get('ui.surfaces')).toEqual({ layers: { collapsed: false } });
  });

  it('is a no-op without legacy keys', () => {
    migrateLegacyPanelFlags(drawPrefs(), window.localStorage);
    expect(drawPrefs().isSet('ui.surfaces')).toBe(false);
  });
});
