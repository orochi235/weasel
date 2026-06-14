import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerDefaultFont, DEFAULT_FONT_FAMILY } from './registerDefaultFont';
import { _resetFontRegistryForTests, getFont } from '../../../../src/features/text/atlas/registerFont';

describe('registerDefaultFont', () => {
  beforeEach(() => { _resetFontRegistryForTests(); });

  it('registers a font under DEFAULT_FONT_FAMILY', async () => {
    // Mock fetch since jsdom doesn't load assets
    const interJson = await import('./inter.json');
    const fakePng = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('.json')) return new Response(JSON.stringify(interJson.default ?? interJson));
      if (url.endsWith('.png')) return new Response(fakePng);
      throw new Error('unexpected url ' + url);
    }) as never;
    global.createImageBitmap = vi.fn().mockResolvedValue(
      { width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap,
    );

    await registerDefaultFont();
    expect(getFont(DEFAULT_FONT_FAMILY)).not.toBeNull();
  });

  it('is idempotent', async () => {
    const interJson = await import('./inter.json');
    const fakePng = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('.json')) return new Response(JSON.stringify(interJson.default ?? interJson));
      if (url.endsWith('.png')) return new Response(fakePng);
      throw new Error('unexpected url ' + url);
    }) as never;
    global.createImageBitmap = vi.fn().mockResolvedValue(
      { width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap,
    );

    await registerDefaultFont();
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await registerDefaultFont();
    // registerFont in core dedupes by family — second call should be a no-op
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCalls);
  });
});
