import { vi } from 'vitest';
import { FIXTURE_FONT } from '../FontAtlas';
import { registerFont } from '../registerFont';

/**
 * Register the two-glyph fixture atlas under an arbitrary family/variant by
 * stubbing the network, not by reaching into the registry — the fetch/parse
 * path stays under test.
 *
 * Stubs `global.fetch` and `global.createImageBitmap` as a side effect.
 */
export async function registerTestFont(
  family: string,
  weight = 400,
  style: 'normal' | 'italic' = 'normal',
): Promise<void> {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
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

  await registerFont(family, { weight, style }, `/fonts/${family}.json`, `/fonts/${family}.png`);
}
