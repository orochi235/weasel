/**
 * The registry is mocked: what this module decides is which families to
 * enroll, and that decision is made entirely from `document.fonts.check`.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const registerCanvasFont = vi.fn();
const listCanvasFonts = vi.fn(() => [] as { family: string; enrollment: string }[]);
const enableLocalFontOutlines = vi.fn(async (_opts?: { families?: readonly string[] }) =>
  ({ families: [] as string[], faces: 0 }));
const unregisterFontOutlines = vi.fn();
vi.mock('@weasel-js/font', () => ({
  registerCanvasFont: (family: string) => registerCanvasFont(family),
  listCanvasFonts: () => listCanvasFonts(),
  enableLocalFontOutlines: (opts?: { families?: readonly string[] }) => enableLocalFontOutlines(opts),
  unregisterFontOutlines: (family: string, variant: unknown) =>
    unregisterFontOutlines(family, variant),
}));

const {
  registerAvailableFonts, genreOf,
  enableMachineFontOutlines, disableMachineFontOutlines,
} = await import('./fonts');

/** Stub `document.fonts.check` to accept exactly `installed`. */
function withInstalled(installed: string[] | Error): void {
  const check = vi.fn((spec: string) => {
    if (installed instanceof Error) throw installed;
    return installed.some((f) => spec.includes(`"${f}"`));
  });
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { check },
  });
}

beforeEach(() => {
  registerCanvasFont.mockReset();
  listCanvasFonts.mockReset();
  listCanvasFonts.mockReturnValue([]);
  enableLocalFontOutlines.mockReset();
  enableLocalFontOutlines.mockResolvedValue({ families: [], faces: 0 });
  unregisterFontOutlines.mockReset();
});

describe('registerAvailableFonts', () => {
  it('enrolls only the families the machine actually has', () => {
    withInstalled(['Georgia', 'Impact']);
    const enrolled = registerAvailableFonts();
    expect(enrolled).toEqual(['Georgia', 'Impact']);
    expect(registerCanvasFont).toHaveBeenCalledTimes(2);
    expect(registerCanvasFont).toHaveBeenCalledWith('Georgia');
    expect(registerCanvasFont).toHaveBeenCalledWith('Impact');
  });

  it('enrolls nothing when the machine has none of them', () => {
    withInstalled([]);
    expect(registerAvailableFonts()).toEqual([]);
    expect(registerCanvasFont).not.toHaveBeenCalled();
  });

  it('quotes multi-word family names in the probe', () => {
    // `check('16px Comic Sans MS')` is a parse error, not a false — an
    // unquoted specifier would throw and take out the whole menu.
    withInstalled(['Comic Sans MS', 'Times New Roman']);
    expect(registerAvailableFonts()).toEqual(['Times New Roman', 'Comic Sans MS']);
  });

  it('treats a throwing probe as "not available" rather than failing', () => {
    withInstalled(new Error('nope'));
    expect(() => registerAvailableFonts()).not.toThrow();
    expect(registerCanvasFont).not.toHaveBeenCalled();
  });

  it('offers breadth: several genres survive a machine with a typical set', () => {
    withInstalled(['Georgia', 'Courier New', 'Impact', 'Comic Sans MS', 'Arial']);
    const genres = new Set(registerAvailableFonts().map((f) => genreOf(f)));
    expect(genres).toEqual(new Set(['serif', 'mono', 'display', 'script', 'sans']));
  });
});

describe('machine-font outlines', () => {
  it('asks only for the families already in the menu', async () => {
    listCanvasFonts.mockReturnValue([
      { family: 'Georgia', enrollment: 'explicit' },
      { family: 'Impact', enrollment: 'explicit' },
    ]);
    enableLocalFontOutlines.mockResolvedValue({ families: ['Georgia'], faces: 3 });

    await expect(enableMachineFontOutlines()).resolves.toEqual(['Georgia']);
    // A machine can carry hundreds of faces; registering all of them to serve
    // a list of eighteen would hold hundreds of inert entries.
    expect(enableLocalFontOutlines).toHaveBeenCalledWith({ families: ['Georgia', 'Impact'] });
  });

  it('propagates a refusal rather than swallowing it', async () => {
    enableLocalFontOutlines.mockRejectedValue(
      new DOMException('denied', 'NotAllowedError'));
    await expect(enableMachineFontOutlines()).rejects.toThrow('denied');
  });

  it('returns the enrolled families to the SDF tier when switched off', () => {
    listCanvasFonts.mockReturnValue([{ family: 'Impact', enrollment: 'explicit' }]);
    disableMachineFontOutlines();

    const families = new Set(unregisterFontOutlines.mock.calls.map((c) => c[0]));
    expect(families).toEqual(new Set(['Impact']));
    // Every weight and slant the local-font indexer could have filed a face
    // under — the registry is keyed by exact variant, so missing one would
    // leave it stranded and still painting outlines.
    expect(unregisterFontOutlines.mock.calls).toHaveLength(18);
  });
});
