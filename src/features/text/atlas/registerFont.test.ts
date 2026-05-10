import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, getFont, _resetFontRegistryForTests } from './registerFont';
import { FIXTURE_FONT } from './FontAtlas';

function stubFetch() {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(FIXTURE_FONT),
      });
    }
    if (url.endsWith('.png')) {
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  }) as typeof fetch;

  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
}

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('registerFont', () => {
  it('stores a parsed BmFont after successful fetch', async () => {
    await registerFont('inter', '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const entry = getFont('inter');
    expect(entry).not.toBeNull();
    expect(entry!.font.info.face).toBe('Inter');
    expect(entry!.font.charMap.size).toBe(2);
  });

  it('calling twice for the same family is a no-op (returns same entry)', async () => {
    await registerFont('inter', '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const first = getFont('inter');
    await registerFont('inter', '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const second = getFont('inter');
    expect(first).toBe(second);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it('getFont returns null for unknown family', () => {
    expect(getFont('unknown')).toBeNull();
  });

  it('rejects with an informative error when fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));
    await expect(
      registerFont('bad', '/bad.json', '/bad.png'),
    ).rejects.toThrow('weasel registerFont');
  });
});
