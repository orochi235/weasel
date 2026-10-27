import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { KitSettingsProvider } from '@weasel-js/react';
import { createPenPreviewLayer, PEN_CLOSE_HIT_PX } from 'domains/paths/penPreviewLayer';
import { usePenTool } from './usePenTool';
import { setup } from './testing/penHarness';

vi.mock('domains/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('domains/paths/penPreviewLayer')>();
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
});
