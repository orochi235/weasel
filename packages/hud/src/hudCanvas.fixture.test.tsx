import { describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { Widget } from './widget';
import { mountHud, stubHudFonts } from './hudCanvas.fixture';

describe('the HUD canvas fixture', () => {
  it('puts the font stubs back when the test ends', () => {
    const fetchBefore = globalThis.fetch;
    stubHudFonts();
    expect(globalThis.fetch).not.toBe(fetchBefore);
    vi.unstubAllGlobals();
    expect(globalThis.fetch).toBe(fetchBefore);
  });

  it('takes its widget off the HUD on unmount', async () => {
    stubHudFonts();
    const dispose = vi.fn();
    const widget: Widget = {
      id: 'w', bounds: { x: 0, y: 0, width: 10, height: 10 }, hidden: false,
      draw: () => [], hitTest: () => false, onPointer: () => {}, dispose,
    };
    await mountHud(widget);
    cleanup();
    expect(dispose).toHaveBeenCalled();
  });
});
