/**
 * The registry is mocked: what this module decides is which families to
 * enroll, and that decision is made entirely from measured text widths.
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

const GENERIC_WIDTH: Record<string, number> = { monospace: 600, serif: 500, 'sans-serif': 520 };

/**
 * Stub canvas text measurement: a font list whose first family is in `installed` measures at a width of its own,
 * and anything else at its generic's width, as a browser does for an absent family. `document.fonts.check` answers
 * true for every family, as the real API does for one the FontFaceSet does not hold.
 */
function withInstalled(installed: string[] | Error, widthOf: (family: string) => number = () => 777): void {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { check: () => true } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
    const ctx = {
      font: '10px sans-serif',
      measureText(): { width: number } {
        if (installed instanceof Error) throw installed;
        const list = ctx.font.replace(/^\d+px /, '');
        const first = /^"([^"]+)"/.exec(list)?.[1];
        if (first !== undefined && installed.includes(first)) return { width: widthOf(first) };
        const generic = list.split(',').at(-1)!.trim();
        return { width: GENERIC_WIDTH[generic]! };
      },
    };
    return ctx;
  }) as never);
}

beforeEach(() => {
  vi.restoreAllMocks();
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

  it('does not enroll an absent family that document.fonts.check vouches for', () => {
    withInstalled(['Georgia']);
    expect(registerAvailableFonts()).toEqual(['Georgia']);
  });

  it('quotes multi-word family names in the probe', () => {
    withInstalled(['Comic Sans MS', 'Times New Roman']);
    expect(registerAvailableFonts()).toEqual(['Times New Roman', 'Comic Sans MS']);
  });

  it('enrolls a family that measures like one generic, by its difference from another', () => {
    // Helvetica is macOS's default sans-serif, so it differs only from serif and monospace.
    withInstalled(['Helvetica'], () => GENERIC_WIDTH['sans-serif']!);
    expect(registerAvailableFonts()).toEqual(['Helvetica']);
  });

  it('enrolls nothing when there is no canvas to measure with', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(registerAvailableFonts()).toEqual([]);
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
