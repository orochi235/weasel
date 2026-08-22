import { describe, it, expect, beforeEach, vi } from 'vitest';
import { canQueryLocalFonts, enableLocalFontOutlines, parseFontStyle } from './localFonts';
import { glyphOutline, listFontOutlines, _resetFontOutlinesForTests } from './outlineRegistry';

function fontData(family: string, style: string) {
  return {
    family,
    style,
    fullName: `${family} ${style}`,
    postscriptName: `${family.replace(/\s/g, '')}-${style.replace(/\s/g, '')}`,
    blob: async () => new Blob([new Uint8Array(4)]),
  };
}

describe('parseFontStyle', () => {
  it('maps the weight words', () => {
    expect(parseFontStyle('Regular')).toEqual({ weight: 400, style: 'normal' });
    expect(parseFontStyle('Bold')).toEqual({ weight: 700, style: 'normal' });
    expect(parseFontStyle('Black')).toEqual({ weight: 900, style: 'normal' });
    expect(parseFontStyle('Medium')).toEqual({ weight: 500, style: 'normal' });
    expect(parseFontStyle('Thin')).toEqual({ weight: 100, style: 'normal' });
  });

  it('prefers the longer name where one contains another', () => {
    // 'Bold' is a substring of all of these; matching it first would file
    // every heavy face under 700.
    expect(parseFontStyle('SemiBold').weight).toBe(600);
    expect(parseFontStyle('DemiBold').weight).toBe(600);
    expect(parseFontStyle('ExtraBold').weight).toBe(800);
    expect(parseFontStyle('UltraBold').weight).toBe(800);
    expect(parseFontStyle('ExtraLight').weight).toBe(200);
  });

  it('reads italic and oblique as the same slant', () => {
    expect(parseFontStyle('Italic')).toEqual({ weight: 400, style: 'italic' });
    expect(parseFontStyle('Bold Italic')).toEqual({ weight: 700, style: 'italic' });
    expect(parseFontStyle('Condensed ExtraLight Oblique'))
      .toEqual({ weight: 200, style: 'italic' });
  });

  it('falls back to regular for anything it does not recognize', () => {
    expect(parseFontStyle('Poster Compressed')).toEqual({ weight: 400, style: 'normal' });
  });
});

describe('enableLocalFontOutlines', () => {
  beforeEach(() => {
    _resetFontOutlinesForTests();
    vi.unstubAllGlobals();
  });

  it('reports the API as absent when the browser has none', () => {
    expect(canQueryLocalFonts()).toBe(false);
  });

  it('rejects rather than half-registering when the API is missing', async () => {
    await expect(enableLocalFontOutlines()).rejects.toThrow(/Local Font Access/);
    expect(listFontOutlines()).toEqual([]);
  });

  it('registers a face per variant, without reading any blob', async () => {
    const georgia = fontData('Georgia', 'Regular');
    const blob = vi.spyOn(georgia, 'blob');
    vi.stubGlobal('queryLocalFonts', vi.fn(async () => [
      georgia,
      fontData('Georgia', 'Bold'),
      fontData('Impact', 'Regular'),
    ]));

    const result = await enableLocalFontOutlines();

    expect(result.families).toEqual(['Georgia', 'Impact']);
    expect(result.faces).toBe(3);
    expect(listFontOutlines()).toEqual([
      { family: 'Georgia', weight: 400, style: 'normal', status: 'idle' },
      { family: 'Georgia', weight: 700, style: 'normal', status: 'idle' },
      { family: 'Impact', weight: 400, style: 'normal', status: 'idle' },
    ]);
    // A machine can hold hundreds of faces and a .ttc runs to tens of MB;
    // reading them at enable time would be worse than not offering the tier.
    expect(blob).not.toHaveBeenCalled();
  });

  it('honors a family filter', async () => {
    vi.stubGlobal('queryLocalFonts', vi.fn(async () => [
      fontData('Georgia', 'Regular'),
      fontData('Impact', 'Regular'),
      fontData('Zapfino', 'Regular'),
    ]));

    const result = await enableLocalFontOutlines({ families: ['Impact'] });

    expect(result.families).toEqual(['Impact']);
    expect(listFontOutlines().map((f) => f.family)).toEqual(['Impact']);
  });

  // "Helvetica Neue Condensed Bold" reduces to the same 700/normal slot as
  // "Helvetica Neue Bold", and only one of them can hold it. The plain face
  // has to win from either query order, or a condensed face paints at the
  // upright face's advances on whichever machine reports it last.
  it.each([['qualified first', true], ['plain first', false]])(
    'keeps the plain face when a qualified one lands on the same slot (%s)',
    async (_label, qualifiedFirst) => {
      const plain = fontData('Helvetica Neue', 'Bold');
      const condensed = fontData('Helvetica Neue', 'Condensed Bold');
      const plainBlob = vi.spyOn(plain, 'blob');
      const condensedBlob = vi.spyOn(condensed, 'blob');
      vi.stubGlobal('queryLocalFonts', vi.fn(async () =>
        (qualifiedFirst ? [condensed, plain] : [plain, condensed])));

      const result = await enableLocalFontOutlines();

      expect(result.faces).toBe(1);
      expect(listFontOutlines()).toEqual([
        { family: 'Helvetica Neue', weight: 700, style: 'normal', status: 'idle' },
      ]);
      glyphOutline('Helvetica Neue', 700, 'normal', 65);
      await vi.waitFor(() => expect(plainBlob).toHaveBeenCalled());
      expect(condensedBlob).not.toHaveBeenCalled();
    },
  );

  it('propagates a denied permission and registers nothing', async () => {
    vi.stubGlobal('queryLocalFonts', vi.fn(async () => {
      throw new DOMException('The user denied access', 'NotAllowedError');
    }));

    await expect(enableLocalFontOutlines()).rejects.toThrow(/denied/);
    expect(listFontOutlines()).toEqual([]);
  });
});
