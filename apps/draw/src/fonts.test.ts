/**
 * The registry is mocked: what this module decides is which families to
 * enroll, and that decision is made entirely from `document.fonts.check`.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const registerCanvasFont = vi.fn();
vi.mock('@weasel-js/font', () => ({
  registerCanvasFont: (family: string) => registerCanvasFont(family),
}));

const { registerAvailableFonts, genreOf } = await import('./fonts');

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
