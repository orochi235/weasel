import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RenderLayer, SceneCanvasApi } from '@weasel-js/core';
import type { Hud } from '../hud';
import { useLoupe, type LoupeSettings } from './useLoupe';

const created = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock('../loupe/createLoupe', () => ({
  createLoupe: (opts: Record<string, unknown>) => {
    created.push(opts);
    return { window: { setHidden: vi.fn() }, setMode: vi.fn(), setFactor: vi.fn(), dispose: vi.fn() };
  },
}));

const SETTINGS: LoupeSettings = { visible: true, mode: 'vector', factor: 4 };
const EVENTS = { onColorChange: () => {}, onClose: () => {} };

function canvas(): { current: SceneCanvasApi } {
  return { current: { surface: {} as HTMLCanvasElement, element: null, requestRedraw: vi.fn(), getPaintedVersion: () => 0 } as unknown as SceneCanvasApi };
}

describe('useLoupe', () => {
  beforeEach(() => { created.length = 0; });

  it('re-renders the given layers', () => {
    const layers: RenderLayer<unknown>[] = [{ id: 'a', label: 'A', space: 'screen', draw: () => [] }];
    renderHook(() => useLoupe(canvas(), {} as Hud, layers, SETTINGS, EVENTS));
    expect(created[0]).toHaveProperty('source');
    expect(created[0]).not.toHaveProperty('views');
  });

  it('paints the canvas as a view when given no layers', () => {
    const ref = canvas();
    renderHook(() => useLoupe(ref, {} as Hud, null, SETTINGS, EVENTS));
    expect(created[0]?.views).toBe(ref.current);
    expect(created[0]).not.toHaveProperty('source');
  });
});
