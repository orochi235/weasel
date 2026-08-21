import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { measureTextBounds } from './measureTextBounds';

function stubFetch() {
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
}

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('measureTextBounds', () => {
  it('returns zero width/height for empty text', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const b = measureTextBounds('', { fontFamily: 'inter', fontSize: 32 });
    expect(b.width).toBe(0);
  });

  it('width grows with text length and height is positive', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const ab = measureTextBounds('AB', { fontFamily: 'inter', fontSize: 32 });
    const abab = measureTextBounds('ABAB', { fontFamily: 'inter', fontSize: 32 });
    expect(ab.width).toBeGreaterThan(0);
    expect(ab.height).toBeGreaterThan(0);
    expect(abab.width).toBeGreaterThan(ab.width);
  });

  it('scales with fontSize', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const small = measureTextBounds('AB', { fontFamily: 'inter', fontSize: 16 });
    const large = measureTextBounds('AB', { fontFamily: 'inter', fontSize: 32 });
    expect(large.width).toBeGreaterThan(small.width);
  });
});

describe('measureTextBounds with maxWidth', () => {
  it('wrapped text is taller and narrower than unwrapped', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const unwrapped = measureTextBounds('AB AB AB', { fontFamily: 'inter', fontSize: 16 });
    const wrapped = measureTextBounds(
      'AB AB AB',
      { fontFamily: 'inter', fontSize: 16 },
      { maxWidth: unwrapped.width / 2 },
    );
    expect(wrapped.height).toBeGreaterThan(unwrapped.height);
    expect(wrapped.width).toBeLessThan(unwrapped.width);
  });

  it('lineHeight opt overrides the style multiplier', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const unwrapped = measureTextBounds('AB AB AB', { fontFamily: 'inter', fontSize: 16 });
    const maxWidth = unwrapped.width / 2;
    const base = measureTextBounds(
      'AB AB AB',
      { fontFamily: 'inter', fontSize: 16 },
      { maxWidth, lineHeight: 1.2 },
    );
    const doubled = measureTextBounds(
      'AB AB AB',
      { fontFamily: 'inter', fontSize: 16 },
      { maxWidth, lineHeight: 2.4 },
    );
    expect(doubled.height).toBeCloseTo(base.height * 2, 5);
  });
});
