/** Counterexamples `registerFont.pbt.test.ts` shrank to, kept as examples. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_FONT } from './FontAtlas';
import { _resetFontRegistryForTests, registerFont, warmFonts } from './registerFont';

beforeEach(() => {
  _resetFontRegistryForTests();
  globalThis.fetch = vi.fn((url: string) => Promise.resolve(url.startsWith('/bad/')
    ? { ok: false, status: 404 }
    : url.endsWith('.json') ? { ok: true, json: () => Promise.resolve(FIXTURE_FONT) } : { ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) })) as unknown as typeof fetch;
  globalThis.createImageBitmap = vi.fn(() => Promise.resolve({ width: 512, height: 512, close() {} })) as unknown as typeof createImageBitmap;
});

describe('atlas registry, shrunk', () => {
  it('warms a family without waiting on a family whose name it begins', async () => {
    registerFont('a', {}, '/ok/a.json', '/ok/a.png', { lazy: true }).catch(() => {});
    registerFont('a|400', {}, '/bad/b.json', '/bad/b.png').catch(() => {});
    await expect(warmFonts(['a'])).resolves.toBeUndefined();
  });
});
