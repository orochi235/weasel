import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { KitSettingsProvider } from '@weasel-js/react';
import { createPenPreviewLayer } from 'features/paths/penPreviewLayer';
import { usePenTool } from './usePenTool';

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
