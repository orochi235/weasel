import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutlineFace } from './OutlineFace';
import { loadFontOutlines, outlineCssSource, registerFontOutlines, _resetFontOutlinesForTests } from './outlineRegistry';

const face: OutlineFace = { unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.5, kernOf: () => 0, glyphD: () => null };

describe('reading an outline source for DOM text', () => {
  beforeEach(() => _resetFontOutlinesForTests());

  it('keeps no copy of a read started after the load took its bytes', async () => {
    const source = vi.fn(() => new ArrayBuffer(4));
    registerFontOutlines('Fake', {}, source, { parser: () => face });
    await expect(loadFontOutlines('Fake')).resolves.toBe('ready');
    const css = outlineCssSource('Fake', 400, 'normal');
    if (!css || !('bytes' in css)) throw new Error('expected a bytes source');
    await css.bytes();
    await css.bytes();
    expect(source).toHaveBeenCalledTimes(3);
  });
});
