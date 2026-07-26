import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useHud } from './useHud';
import type { CanvasExtensionApi } from '@weasel-js/core';
import { _resetFontRegistryForTests } from '../../../core/src/features/text/atlas/registerFont';

function makeApi(): CanvasExtensionApi {
  return {
    element: null,
    requestRedraw: vi.fn(),
    registerLayer: vi.fn(() => () => {}),
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
});
