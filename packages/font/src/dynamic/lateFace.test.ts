import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getDynamicFace, refreshCanvasFont, resetBakeBudget,
  _resetDynamicFontsForTests, __setGlyphRasterizerForTests, _getPagesForTests,
} from './dynamicAtlas';
import { subscribeGlyphReady } from '../glyphReady';
import { BAKE_SIZE } from './glyphRasterizer';

beforeEach(() => _resetDynamicFontsForTests());
afterEach(() => vi.restoreAllMocks());

describe('refreshCanvasFont', () => {
  /** A rasterizer whose every measure follows `wide`, as a face that just loaded would. */
  function swappable(): { wide: boolean } {
    const state = { wide: false };
    __setGlyphRasterizerForTests({
      faceMetrics: () => (state.wide ? { ascent: 44, descent: 12 } : { ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(480).fill(255),
        left: -8, top: 26, advance: state.wide ? 30 : 22,
      }),
    });
    return state;
  }

  it('measures a family again in the faces already handed out, and says so', () => {
    const state = swappable();
    const notified = vi.fn();
    subscribeGlyphReady(notified);
    const face = getDynamicFace('Roboto', 400, 'normal');
    const bold = getDynamicFace('Roboto', 700, 'normal');
    const other = getDynamicFace('Futura', 400, 'normal');
    const kept = other.requestGlyph(65);
    expect(face.requestGlyph(65).xadvance).toBe(22);
    bold.requestGlyph(65);

    state.wide = true;
    refreshCanvasFont('"roboto"');
    expect(notified).toHaveBeenCalledTimes(1);
    expect(getDynamicFace('Roboto', 400, 'normal')).toBe(face);
    expect(face.requestGlyph(65).xadvance).toBe(30);
    expect(face.font.chars).toHaveLength(1);
    expect(face.font.common).toMatchObject({ base: 44, lineHeight: 56 });
    expect(face.font.faceMetrics).toMatchObject({ ascent: 44 / BAKE_SIZE, descent: 12 / BAKE_SIZE });
    expect(bold.requestGlyph(65).xadvance).toBe(30);
    expect(other.requestGlyph(65)).toBe(kept);
  });

  it('measures every family again when none is named', () => {
    const state = swappable();
    const a = getDynamicFace('Roboto', 400, 'normal');
    const b = getDynamicFace('Futura', 400, 'normal');
    a.requestGlyph(65);
    b.requestGlyph(65);
    state.wide = true;
    refreshCanvasFont();
    expect(a.requestGlyph(65).xadvance).toBe(30);
    expect(b.requestGlyph(65).xadvance).toBe(30);
  });

  it('says nothing for a family the tier holds no face of', () => {
    const notified = vi.fn();
    getDynamicFace('Roboto', 400, 'normal');
    subscribeGlyphReady(notified);
    refreshCanvasFont('Futura');
    expect(notified).not.toHaveBeenCalled();
  });

  it('does not bake a glyph that was waiting when its face was measured again', () => {
    vi.useFakeTimers();
    try {
      swappable();
      resetBakeBudget(0);
      const face = getDynamicFace('Roboto', 400, 'normal');
      face.requestGlyph(65);
      refreshCanvasFont('Roboto');
      vi.runAllTimers();
      expect(_getPagesForTests()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a font the document finishes loading', () => {
  const fonts = new EventTarget();
  const loaded = (...families: string[]): Event =>
    Object.assign(new Event('loadingdone'), { fontfaces: families.map((family) => ({ family })) });
  beforeEach(() => { Object.defineProperty(document, 'fonts', { value: fonts, configurable: true }); });
  afterEach(() => { delete (document as { fonts?: unknown }).fonts; });

  it('is measured again when the tier holds a face of that family', () => {
    const state = { advance: 22 };
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({ width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: state.advance }),
    });
    const face = getDynamicFace('Roboto', 400, 'normal');
    expect(face.requestGlyph(65).xadvance).toBe(22);
    state.advance = 30;
    fonts.dispatchEvent(loaded('Open Sans'));
    expect(face.requestGlyph(65).xadvance).toBe(22);
    fonts.dispatchEvent(loaded('Open Sans', '"Roboto"'));
    expect(face.requestGlyph(65).xadvance).toBe(30);
  });

  it('is listened for once, and no longer once the tier is reset', () => {
    const add = vi.spyOn(fonts, 'addEventListener');
    const remove = vi.spyOn(fonts, 'removeEventListener');
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({ width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 1 }),
    });
    getDynamicFace('Roboto', 400, 'normal');
    getDynamicFace('Futura', 400, 'normal');
    expect(add).toHaveBeenCalledTimes(1);
    _resetDynamicFontsForTests();
    expect(remove).toHaveBeenCalledWith('loadingdone', add.mock.calls[0][1]);
  });
});
