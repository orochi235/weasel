import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { HudGalleryDemo } from '../HudGalleryDemo';

describe('HudGalleryDemo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('closes its sprite bitmap when it unmounts, loaded or not', async () => {
    const bitmaps: { closed: boolean }[] = [];
    const bitmap = () => { const b = { width: 5, height: 5, closed: false, close() { b.closed = true; } }; bitmaps.push(b); return b; };
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    vi.stubGlobal('createImageBitmap', async () => bitmap());

    const loaded = render(<HudGalleryDemo />);
    await act(async () => {});
    loaded.unmount();

    const early = render(<HudGalleryDemo />);
    early.unmount();
    await act(async () => {});

    expect(bitmaps.length).toBeGreaterThanOrEqual(2);
    expect(bitmaps.filter((b) => !b.closed)).toEqual([]);
  });
});
