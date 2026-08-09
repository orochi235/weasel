import { describe, it, expect } from 'vitest';
import { createImage } from './image';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';

const DEFAULT_RESOLVED_TOKENS = resolveTheme(weaselTheme, 'dark');

describe('image widget', () => {
  it('emits an ImageDrawCommand for its bounds', () => {
    const fakeImage = {} as ImageBitmap;
    const i = createImage({ id: 'i', x: 1, y: 2, w: 3, h: 4, image: fakeImage });
    const cmds = i.draw({ dims: { width: 100, height: 100 }, defaultFont: 'd', tokens: DEFAULT_RESOLVED_TOKENS });
    expect(cmds[0]).toMatchObject({ kind: 'image', x: 1, y: 2, w: 3, h: 4 });
  });

  it('throws on zero/negative bounds', () => {
    const fakeImage = {} as ImageBitmap;
    expect(() => createImage({ id: 'i', x: 0, y: 0, w: 0, h: 10, image: fakeImage })).toThrow();
  });

  it('hitTest returns true inside, false outside', () => {
    const fakeImage = {} as ImageBitmap;
    const i = createImage({ id: 'i', x: 10, y: 10, w: 20, h: 20, image: fakeImage });
    expect(i.hitTest(15, 15)).toBe(true);
    expect(i.hitTest(0, 0)).toBe(false);
  });
});
