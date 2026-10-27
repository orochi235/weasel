import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePenTool } from './usePenTool';
import { createPenPreviewLayer } from 'domains/paths/penPreviewLayer';
import { createPointerStore } from '@weasel-js/routing/react';
import { setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('domains/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('domains/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});
const previewLayers = vi.mocked(createPenPreviewLayer);

describe('usePenTool', () => {
  it('declares id "pen" and a cursor function', () => {
    const { tool } = setup();
    expect(tool.id).toBe('pen');
    expect(typeof tool.cursor).toBe('function');
  });

  it('cursor is the nib glyph normally, "pointer" while the close hint shows', () => {
    // jsdom draws no cursor; this checks the string handed to the host. The
    // close hint stays a keyword because it is about what the next click does,
    // not about which tool is active.
    const pointer = createPointerStore();
    const p = setup({ deps: { pointer }, closeHitRadius: 8 });
    const cursor = p.tool.cursor as () => string;
    expect(cursor()).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(cursor()).toMatch(/, crosshair$/);
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    act(() => { pointer.set({ worldX: 3, worldY: 3, viewId: null }); });
    expect(cursor()).toBe('pointer');
    act(() => { pointer.set({ worldX: 40, worldY: 40, viewId: null }); });
    expect(cursor()).toMatch(/, crosshair$/);
  });

  it('keeps one state object, and one overlay painting from it, across renders', () => {
    const before = previewLayers.mock.calls.length;
    const { result, rerender } = renderHook(() => usePenTool());
    const overlay = result.current.overlay;
    rerender();
    expect(previewLayers.mock.calls.length).toBe(before + 1);
    expect(result.current.overlay).toBe(overlay);
    expect(overlay).toBe(previewLayers.mock.results.at(-1)!.value);
  });

  describe('bindings', () => {
    it('routes plain click, mod-click, double-click, drag, Enter and Escape', () => {
      const { tool } = setup();
      const routes = (tool.bindings ?? []).map((b) => [
        b.spec.kind,
        'key' in b.spec ? b.spec.key : (b.spec.mods?.mod === true ? 'mod' : ''),
        b.actionId,
      ]);
      expect(routes).toEqual([
        ['click', '', 'pen.placeAnchor'],
        ['click', 'mod', 'pen.finishOpen'],
        ['doubleClick', '', 'pen.finishOpen'],
        ['drag', '', 'pen.dragHandle'],
        ['key', 'Enter', 'pen.finish'],
        ['key', 'Escape', 'pen.cancel'],
      ]);
    });
  });
});
