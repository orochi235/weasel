import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { KitSettingsProvider } from '@weasel-js/react';
import { type PolygonPath, pathFromD } from '@weasel-js/geom';
import { createPenPreviewLayer, PEN_ANCHOR_SNAP_PX, PEN_CLOSE_HIT_PX } from 'features/paths/penPreviewLayer';
import { usePenTool } from './usePenTool';
import { setup } from './testing/penHarness';

vi.mock('features/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('features/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

describe('usePenTool preview dots', () => {
  it('hands the layer the provider\'s kit settings', () => {
    vi.mocked(createPenPreviewLayer).mockClear();
    renderHook(() => usePenTool(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <KitSettingsProvider value={{ targets: { penAnchorRadiusPx: 6, penHandleDotRadiusPx: 5, penCloseHintRadiusPx: 11 } }}>
          {children}
        </KitSettingsProvider>
      ),
    });
    const kit = vi.mocked(createPenPreviewLayer).mock.calls[0]![0].kitSettings?.();
    expect([kit?.get('targets.penAnchorRadiusPx'), kit?.get('targets.penHandleDotRadiusPx'), kit?.get('targets.penCloseHintRadiusPx')])
      .toEqual([6, 5, 11]);
  });

  it('hands the layer a store that sets nothing with no provider, so it uses its constants', () => {
    vi.mocked(createPenPreviewLayer).mockClear();
    renderHook(() => usePenTool());
    const kit = vi.mocked(createPenPreviewLayer).mock.calls[0]![0].kitSettings?.();
    expect(kit?.get('targets.penAnchorRadiusPx')).toBeUndefined();
  });
});

describe('usePenTool reach', () => {
  /** Whether a click `d` px right of the first of three anchors closes the subpath. */
  const closesAt = (d: number, over: Parameters<typeof setup>[0] = {}) => {
    const p = setup(over);
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    p.click(d, 0);
    return p.adapter.addNode.mock.calls.length === 1;
  };

  it('closes within targets.penCloseHitPx, else PEN_CLOSE_HIT_PX, and an option beats both', () => {
    expect([closesAt(PEN_CLOSE_HIT_PX - 1), closesAt(PEN_CLOSE_HIT_PX + 1)]).toEqual([true, false]);
    expect(closesAt(15, { kitSettings: { targets: { penCloseHitPx: 20 } } })).toBe(true);
    expect(closesAt(15, { closeHitRadius: 4, kitSettings: { targets: { penCloseHitPx: 20 } } })).toBe(false);
  });

  /** Where a click `d` px right of another path's interior anchor lands. */
  const landsAt = (d: number, over: Parameters<typeof setup>[0] = {}) => {
    const p = setup({ paths: { n1: pathFromD('M 300 0 L 400 0 L 500 0') as PolygonPath }, ...over });
    p.click(400 + d, 0);
    return p.scratch.current!.anchors[0]!.x;
  };

  it('snaps to an anchor within targets.penAnchorSnapPx, else PEN_ANCHOR_SNAP_PX, and an option beats both', () => {
    expect([landsAt(PEN_ANCHOR_SNAP_PX - 1), landsAt(PEN_ANCHOR_SNAP_PX + 1)]).toEqual([400, 400 + PEN_ANCHOR_SNAP_PX + 1]);
    expect(landsAt(15, { kitSettings: { targets: { penAnchorSnapPx: 20 } } })).toBe(400);
    expect(landsAt(15, { anchorSnapRadius: 0, kitSettings: { targets: { penAnchorSnapPx: 20 } } })).toBe(415);
  });
});
