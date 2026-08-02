import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerFontOutlines, unregisterFontOutlines, hasFontOutlines,
  outlineStatus, listFontOutlines, glyphOutline, _resetFontOutlinesForTests,
} from './outlineRegistry';
import type { OutlineFace, OutlineParser } from './OutlineFace';
import { subscribeGlyphReady, _clearGlyphReadySubscribers } from '../glyphReady';

/** A face that answers for 'A' and nothing else. */
const stubFace: OutlineFace = {
  unitsPerEm: 1000,
  glyphD: (cp) => (cp === 65 ? 'M0 0L0.5 -0.7L1 0Z' : null),
};

const stubParser: OutlineParser = () => stubFace;

/** Let the registry's internal load promise settle. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('outline registry', () => {
  beforeEach(() => {
    _resetFontOutlinesForTests();
    _clearGlyphReadySubscribers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers without loading anything', () => {
    const source = vi.fn(() => new ArrayBuffer(4));
    registerFontOutlines('Fake', { weight: 400 }, source, { parser: stubParser });

    expect(hasFontOutlines('Fake', 400, 'normal')).toBe(true);
    expect(outlineStatus('Fake', 400, 'normal')).toBe('idle');
    // Registration is the cheap half — the bytes are not read until a frame
    // actually asks for a glyph.
    expect(source).not.toHaveBeenCalled();
  });

  it('returns null on the first ask, then the outline once loaded', async () => {
    registerFontOutlines('Fake', {}, new ArrayBuffer(4), { parser: stubParser });

    // Synchronous by construction: the first call can only start the load.
    expect(glyphOutline('Fake', 400, 'normal', 65)).toBeNull();
    expect(outlineStatus('Fake', 400, 'normal')).toBe('loading');

    await settle();
    expect(outlineStatus('Fake', 400, 'normal')).toBe('ready');
    expect(glyphOutline('Fake', 400, 'normal', 65)).toBe('M0 0L0.5 -0.7L1 0Z');
  });

  it('notifies glyph-ready when a face lands, so a static canvas redraws', async () => {
    const seen = vi.fn();
    subscribeGlyphReady(seen);
    registerFontOutlines('Fake', {}, new ArrayBuffer(4), { parser: stubParser });

    glyphOutline('Fake', 400, 'normal', 65);
    expect(seen).not.toHaveBeenCalled();
    await settle();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('reports a codepoint the face lacks as null, and asks the face once', async () => {
    const glyphD = vi.fn(stubFace.glyphD);
    registerFontOutlines('Fake', {}, new ArrayBuffer(4), {
      parser: () => ({ unitsPerEm: 1000, glyphD }),
    });
    glyphOutline('Fake', 400, 'normal', 65);
    await settle();

    expect(glyphOutline('Fake', 400, 'normal', 0x4e00)).toBeNull();
    expect(glyphOutline('Fake', 400, 'normal', 0x4e00)).toBeNull();
    // The miss is memoized too: it is asked for on every frame that draws the
    // character, and re-deriving it would mean a cmap lookup forever.
    expect(glyphD).toHaveBeenCalledTimes(1);
  });

  it('matches the variant exactly rather than falling back', async () => {
    registerFontOutlines('Fake', { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: stubParser,
    });
    glyphOutline('Fake', 400, 'normal', 65);
    await settle();

    // Painting 400-weight outlines at 700-weight advances looks worse than the
    // SDF it would replace, so a variant miss declines rather than substitutes.
    expect(glyphOutline('Fake', 700, 'normal', 65)).toBeNull();
    expect(glyphOutline('Fake', 400, 'italic', 65)).toBeNull();
    expect(glyphOutline('Other', 400, 'normal', 65)).toBeNull();
  });

  it('degrades to null and warns once when the bytes will not load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerFontOutlines('Broken', {}, () => Promise.reject(new Error('offline')), {
      parser: stubParser,
    });

    glyphOutline('Broken', 400, 'normal', 65);
    await settle();

    expect(outlineStatus('Broken', 400, 'normal')).toBe('failed');
    expect(glyphOutline('Broken', 400, 'normal', 65)).toBeNull();
    glyphOutline('Broken', 400, 'normal', 66);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('offline');
  });

  it('survives a parser that throws on one glyph', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerFontOutlines('Fake', {}, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000,
        glyphD: (cp) => {
          if (cp === 66) throw new Error('bad glyf entry');
          return 'M0 0Z';
        },
      }),
    });
    glyphOutline('Fake', 400, 'normal', 65);
    await settle();

    expect(glyphOutline('Fake', 400, 'normal', 66)).toBeNull();
    // One bad glyph costs that glyph, not the face.
    expect(glyphOutline('Fake', 400, 'normal', 65)).toBe('M0 0Z');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reads a URL source through fetch', async () => {
    const bytes = new ArrayBuffer(8);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => bytes,
    })));
    const parser = vi.fn(stubParser);
    registerFontOutlines('Fake', {}, 'https://example.test/f.ttf', { parser });

    glyphOutline('Fake', 400, 'normal', 65);
    await settle();

    expect(fetch).toHaveBeenCalledWith('https://example.test/f.ttf');
    expect(parser).toHaveBeenCalledWith(bytes);
    vi.unstubAllGlobals();
  });

  it('reports an HTTP failure as a load failure, not a parse of the error page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    registerFontOutlines('Fake', {}, 'https://example.test/missing.ttf', { parser: stubParser });

    glyphOutline('Fake', 400, 'normal', 65);
    await settle();

    expect(outlineStatus('Fake', 400, 'normal')).toBe('failed');
    expect(warn.mock.calls[0][0]).toContain('404');
    vi.unstubAllGlobals();
  });

  it('unregisters', async () => {
    registerFontOutlines('Fake', {}, new ArrayBuffer(4), { parser: stubParser });
    glyphOutline('Fake', 400, 'normal', 65);
    await settle();

    unregisterFontOutlines('Fake', {});
    expect(hasFontOutlines('Fake')).toBe(false);
    expect(outlineStatus('Fake')).toBeNull();
    expect(glyphOutline('Fake', 400, 'normal', 65)).toBeNull();
  });

  /**
   * A glyph contour is closed by definition — TrueType and CFF have no other
   * kind — but not every serializer says so, and the ones that don't are
   * invisible until someone strokes the result: a fill closes the contour
   * implicitly (earcut joins last to first), while a stroke follows the path
   * it is given and leaves the closing edge unpainted, capped at both ends.
   */
  describe('contour closure', () => {
    const openParser: OutlineParser = () => ({
      unitsPerEm: 1000,
      glyphD: (cp) => (cp === 65 ? 'M0 0L0.5-0.7L1 0' : null),
    });

    const twoContourParser: OutlineParser = () => ({
      unitsPerEm: 1000,
      glyphD: (cp) => (cp === 65 ? 'M0 0L1 0L1-1M0.2-0.2L0.8-0.2L0.8-0.8' : null),
    });

    it('closes a contour the parser left open', async () => {
      registerFontOutlines('Open', {}, new ArrayBuffer(4), { parser: openParser });
      glyphOutline('Open', 400, 'normal', 65);
      await settle();
      expect(glyphOutline('Open', 400, 'normal', 65)).toBe('M0 0L0.5-0.7L1 0Z');
    });

    it('closes every contour, not just the last', async () => {
      registerFontOutlines('Two', {}, new ArrayBuffer(4), { parser: twoContourParser });
      glyphOutline('Two', 400, 'normal', 65);
      await settle();
      expect(glyphOutline('Two', 400, 'normal', 65))
        .toBe('M0 0L1 0L1-1ZM0.2-0.2L0.8-0.2L0.8-0.8Z');
    });

    it('leaves an already-closed contour alone', async () => {
      registerFontOutlines('Closed', {}, new ArrayBuffer(4), { parser: stubParser });
      glyphOutline('Closed', 400, 'normal', 65);
      await settle();
      expect(glyphOutline('Closed', 400, 'normal', 65)).toBe('M0 0L0.5 -0.7L1 0Z');
    });
  });

  it('enumerates registered faces in a stable order', () => {
    registerFontOutlines('Zed', { weight: 700 }, new ArrayBuffer(4), { parser: stubParser });
    registerFontOutlines('Abe', { weight: 400, style: 'italic' }, new ArrayBuffer(4), { parser: stubParser });
    registerFontOutlines('Abe', { weight: 400 }, new ArrayBuffer(4), { parser: stubParser });

    expect(listFontOutlines()).toEqual([
      { family: 'Abe', weight: 400, style: 'italic', status: 'idle' },
      { family: 'Abe', weight: 400, style: 'normal', status: 'idle' },
      { family: 'Zed', weight: 700, style: 'normal', status: 'idle' },
    ]);
  });
});
