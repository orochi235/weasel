import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDomMeasureEnv } from './createDomMeasureEnv';

describe('createDomMeasureEnv', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('measures text in the style, weight, size, and family it is asked for', () => {
    const fonts: string[] = [];
    const fake = {
      set font(f: string) { fonts.push(f); },
      measureText: () => ({ width: 10, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2, actualBoundingBoxAscent: 7 }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake as never);
    const env = createDomMeasureEnv(document.body);
    env.text('a', { family: 'Inter', size: 12, weight: 600, style: 'italic' });
    env.text('a', { family: 'Inter', size: 12 });
    expect(fonts).toEqual(['italic 600 12px "Inter"', 'normal 400 12px "Inter"']);
  });
});
