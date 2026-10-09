import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cssFontFamily, cssFontFamilyLoading, _resetDomFacesForTests } from './domFace';
import { _resetFontRegistryForTests } from './registerFont';
import { registerCanvasFont, _resetDynamicFontsForTests } from './dynamic/dynamicAtlas';
import { registerFontOutlines, loadFontOutlines, _resetFontOutlinesForTests } from './outline/outlineRegistry';
import { registerTestFont } from './testing/registerTestFont';

/** jsdom has neither `FontFace` nor `document.fonts`; record what gets built. */
class StubFace {
  static made: StubFace[] = [];
  constructor(
    public family: string,
    public source: string | ArrayBuffer,
    public descriptors: FontFaceDescriptors,
  ) { StubFace.made.push(this); }
  static gate: Promise<unknown> = Promise.resolve();
  load() { return StubFace.gate.then(() => this); }
}

const PARSED = { unitsPerEm: 1000, ascender: 0.8, glyphD: () => null, advanceOf: () => 0.5, kernOf: () => 0 };

const fonts = { add: vi.fn(), delete: vi.fn() };

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetDynamicFontsForTests();
  _resetFontOutlinesForTests();
  _resetDomFacesForTests();
  StubFace.made = [];
  StubFace.gate = Promise.resolve();
  fonts.add.mockClear();
  fonts.delete.mockClear();
  vi.stubGlobal('FontFace', StubFace);
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'fonts');
  vi.restoreAllMocks();
});

describe('cssFontFamily', () => {
  it('names a private face built from the outline file when the canvas draws an atlas', async () => {
    await registerTestFont('sans-serif');
    registerFontOutlines('sans-serif', {}, '/fonts/inter.ttf');
    registerFontOutlines('sans-serif', { weight: 700 }, '/fonts/inter-bold.ttf');

    expect(cssFontFamily('sans-serif')).toBe('"weasel-face-0", sans-serif');
    expect(StubFace.made.map((f) => [f.family, f.source, f.descriptors.weight])).toEqual([
      ['weasel-face-0', 'url("/fonts/inter.ttf")', '400'],
      ['weasel-face-0', 'url("/fonts/inter-bold.ttf")', '700'],
    ]);
    expect(fonts.add).toHaveBeenCalledTimes(2);
  });

  it('builds each face once', async () => {
    await registerTestFont('sans-serif');
    registerFontOutlines('sans-serif', {}, '/fonts/inter.ttf');
    cssFontFamily('sans-serif');
    cssFontFamily('sans-serif', { weight: 700 });
    expect(StubFace.made).toHaveLength(1);
  });

  it('replaces a face whose registration changed', async () => {
    await registerTestFont('sans-serif');
    registerFontOutlines('sans-serif', {}, '/fonts/a.ttf');
    cssFontFamily('sans-serif');
    registerFontOutlines('sans-serif', {}, '/fonts/b.ttf');
    cssFontFamily('sans-serif');
    expect(fonts.delete).toHaveBeenCalledWith(StubFace.made[0]);
    expect(StubFace.made[1].source).toBe('url("/fonts/b.ttf")');
  });

  it('takes the registration\'s cssSrc over its source', async () => {
    await registerTestFont('Helvetica');
    registerFontOutlines('Helvetica', {}, () => new ArrayBuffer(4), { cssSrc: 'local("Helvetica")' });
    cssFontFamily('Helvetica');
    expect(StubFace.made[0].source).toBe('local("Helvetica")');
  });

  it('hands over the bytes of a source with no URL', async () => {
    const bytes = new ArrayBuffer(8);
    const face = { unitsPerEm: 1000, ascender: 0.8, glyphD: () => null, advanceOf: () => 0.5, kernOf: () => 0 };
    registerFontOutlines('Custom', {}, bytes, { parser: () => face });
    expect(cssFontFamily('Custom')).toBe('"weasel-face-0", "Custom"');
    await vi.waitFor(() => expect(StubFace.made).toHaveLength(1));
    expect(StubFace.made[0].source).toBe(bytes);
  });

  it('leaves a family the canvas draws through the browser alone', () => {
    registerCanvasFont('Georgia');
    registerFontOutlines('Georgia', {}, '/fonts/georgia.ttf');
    expect(cssFontFamily('Georgia')).toBe('Georgia');
    expect(StubFace.made).toHaveLength(0);
  });

  it('warns once, and names the fix, for an atlas with no font file', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await registerTestFont('sans-serif');
    expect(cssFontFamily('sans-serif')).toBe('sans-serif');
    cssFontFamily('sans-serif');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('registerFontOutlines("sans-serif"');
  });

  it('answers the family itself outside a browser', async () => {
    vi.stubGlobal('FontFace', undefined);
    await registerTestFont('sans-serif');
    registerFontOutlines('sans-serif', {}, '/fonts/inter.ttf');
    expect(cssFontFamily('sans-serif')).toBe('sans-serif');
  });
});

describe('building the DOM face when the bytes arrive', () => {
  it('builds it at registration from bytes handed over directly', async () => {
    const bytes = new ArrayBuffer(8);
    registerFontOutlines('Custom', {}, bytes, { parser: () => PARSED });
    expect(StubFace.made.map((f) => [f.family, f.source])).toEqual([['weasel-face-0', bytes]]);
    cssFontFamily('Custom');
    expect(StubFace.made).toHaveLength(1);
  });

  it('builds it from the bytes the canvas read, not the URL a second time', async () => {
    const bytes = new ArrayBuffer(8);
    await registerTestFont('sans-serif');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
    registerFontOutlines('sans-serif', {}, '/fonts/inter.ttf', { parser: () => PARSED });
    expect(StubFace.made).toHaveLength(0);
    await loadFontOutlines('sans-serif');
    expect(StubFace.made).toHaveLength(1);
    expect(Object.prototype.toString.call(StubFace.made[0].source)).toBe('[object ArrayBuffer]');
    cssFontFamily('sans-serif');
    expect(StubFace.made).toHaveLength(1);
  });

  it('fetches nothing for a URL or thunk registration', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const thunk = vi.fn(() => new ArrayBuffer(8));
    registerFontOutlines('A', {}, '/fonts/a.ttf');
    registerFontOutlines('B', {}, thunk);
    expect(fetch).not.toHaveBeenCalled();
    expect(thunk).not.toHaveBeenCalled();
    expect(StubFace.made).toHaveLength(0);
  });

  it('keeps a cssSrc over bytes the canvas read', async () => {
    await registerTestFont('Helvetica');
    registerFontOutlines('Helvetica', {}, () => new ArrayBuffer(4),
      { cssSrc: 'local("Helvetica")', parser: () => PARSED });
    await loadFontOutlines('Helvetica');
    expect(StubFace.made.map((f) => f.source)).toEqual(['local("Helvetica")']);
  });
});

describe('cssFontFamilyLoading', () => {
  it('hands back the load in flight, then nothing once it lands', async () => {
    let open!: () => void;
    StubFace.gate = new Promise<void>((r) => { open = r; });
    await registerTestFont('sans-serif');
    registerFontOutlines('sans-serif', {}, '/fonts/inter.ttf');
    const loading = cssFontFamilyLoading('sans-serif');
    expect(loading).toBeInstanceOf(Promise);
    open();
    await loading;
    expect(cssFontFamilyLoading('sans-serif')).toBeNull();
  });

  it('waits on the variant asked for, not its siblings', async () => {
    await registerTestFont('sans-serif');
    registerFontOutlines('sans-serif', {}, '/fonts/inter.ttf');
    await cssFontFamilyLoading('sans-serif');
    let open!: () => void;
    StubFace.gate = new Promise<void>((r) => { open = r; });
    registerFontOutlines('sans-serif', { weight: 700 }, '/fonts/inter-bold.ttf');
    expect(cssFontFamilyLoading('sans-serif')).toBeNull();
    expect(cssFontFamilyLoading('sans-serif', { weight: 700 })).toBeInstanceOf(Promise);
    open();
  });

  it('settles, without rejecting, on a face that fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    StubFace.gate = Promise.reject(new Error('bad font'));
    StubFace.gate.catch(() => {});
    await registerTestFont('sans-serif');
    registerFontOutlines('sans-serif', {}, '/fonts/inter.ttf');
    await expect(cssFontFamilyLoading('sans-serif')).resolves.toBeUndefined();
    expect(cssFontFamilyLoading('sans-serif')).toBeNull();
  });

  it('has nothing to wait for on a family the browser draws', () => {
    registerCanvasFont('Georgia');
    expect(cssFontFamilyLoading('Georgia')).toBeNull();
  });
});
