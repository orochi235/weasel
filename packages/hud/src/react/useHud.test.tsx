import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useHud, useHudContribution } from './useHud';
import type { CanvasExtensionApi } from '@weasel-js/core';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { createPaintedCursorState } from '@weasel-js/core';

const IDENTITY_VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function makeApi(): CanvasExtensionApi {
  return {
    element: null,
    surface: null,
    getSurfaceRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    requestRedraw: vi.fn(),
    subscribeFrame: vi.fn(() => () => {}),
    hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn(() => () => {}),
    getView: vi.fn(() => IDENTITY_VIEW),
    setView: vi.fn(),
    subscribeView: vi.fn(() => () => {}),
    getPaintedVersion: vi.fn(() => 0),
    paintedCursor: createPaintedCursorState(),
  };
}

describe('useHud', () => {
  beforeEach(() => {
    _resetFontRegistryForTests();
    global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
    global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
  });

  it('attaches on mount when ref is populated', () => {
    const api = makeApi();
    function useHarness() {
      const ref = useRef<CanvasExtensionApi>(api);
      const hud = useHud(ref);
      return hud;
    }
    const { result } = renderHook(useHarness);
    expect(result.current.attached).toBe(true);
    expect(api.registerLayer).toHaveBeenCalledTimes(1);
  });

  it('detaches on unmount', () => {
    const api = makeApi();
    function useHarness() {
      const ref = useRef<CanvasExtensionApi>(api);
      const hud = useHud(ref);
      return hud;
    }
    const { result, unmount } = renderHook(useHarness);
    expect(result.current.attached).toBe(true);
    unmount();
    expect(result.current.attached).toBe(false);
  });

  it('returns the same Hud across re-renders', () => {
    const api = makeApi();
    function useHarness() {
      const ref = useRef<CanvasExtensionApi>(api);
      const hud = useHud(ref);
      return hud;
    }
    const { result, rerender } = renderHook(useHarness);
    const first = result.current;
    act(() => { rerender(); });
    expect(result.current).toBe(first);
  });

  it('attaches through its contribution when given no ref', () => {
    const api = makeApi();
    const { result } = renderHook(() => {
      const hud = useHud();
      return { hud, entry: useHudContribution(hud) };
    });
    expect(result.current.hud.attached).toBe(false);
    const detach = result.current.entry.attach!(api, { get: () => undefined });
    expect(result.current.hud.attached).toBe(true);
    expect(api.registerLayer).toHaveBeenCalledTimes(1);
    detach();
    expect(result.current.hud.attached).toBe(false);
  });

  it('gives an entry with no HUD no attach', () => {
    const { result } = renderHook(() => useHudContribution());
    expect(result.current.attach).toBeUndefined();
  });
});
