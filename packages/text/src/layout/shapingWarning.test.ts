import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { warnShapingWithoutEngine, _resetShapingWarningForTests } from './shaperRegistry';

const cps = (s: string): number[] => Array.from(s, (c) => c.codePointAt(0)!);

describe('warnShapingWithoutEngine', () => {
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    _resetShapingWarningForTests();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('says once how to register a shaper for Arabic or Devanagari', () => {
    warnShapingWithoutEngine(cps('سلام'));
    warnShapingWithoutEngine(cps('नमस्ते'));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/registerShaper\(await loadShaper\(\)\)/);
  });

  it('stays quiet for scripts set one glyph per code point', () => {
    warnShapingWithoutEngine(cps('Hello Ελληνικά Кириллица 漢字 אבג'));
    expect(warn).not.toHaveBeenCalled();
  });
});
