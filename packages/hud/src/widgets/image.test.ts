import { describe, it, expect } from 'vitest';
import { createImage } from './image';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';

const DEFAULT_RESOLVED_TOKENS = resolveTheme(weaselTheme, 'dark');
const ctx = { dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: DEFAULT_RESOLVED_TOKENS };

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

  it('forwards sampling to the image draw command', () => {
    const bmp = { width: 4, height: 4, close: () => {} } as unknown as ImageBitmap;
    const w = createImage({ id: 'i', x: 0, y: 0, w: 40, h: 40, image: bmp, sampling: 'nearest' });
    const cmd = w.draw(ctx)[0];
    expect(cmd).toMatchObject({ kind: 'image', sampling: 'nearest' });
  });

  it('forwards the source rect and flips to the image draw command', () => {
    const bmp = { width: 64, height: 32, close: () => {} } as unknown as ImageBitmap;
    const w = createImage({
      id: 'i', x: 0, y: 0, w: 16, h: 16, image: bmp,
      source: { x: 16, y: 0, w: 16, h: 16 }, flipX: true,
    });
    expect(w.draw(ctx)[0]).toMatchObject({
      kind: 'image', source: { x: 16, y: 0, w: 16, h: 16 }, flipX: true,
    });
  });

  it('setSource changes the sampled frame and notifies', () => {
    const bmp = { width: 64, height: 32, close: () => {} } as unknown as ImageBitmap;
    let changes = 0;
    const w = createImage({
      id: 'i', x: 0, y: 0, w: 16, h: 16, image: bmp,
      source: { x: 0, y: 0, w: 16, h: 16 }, onChange: () => { changes++; },
    });
    w.setSource({ x: 32, y: 0, w: 16, h: 16 });
    expect(w.draw(ctx)[0]).toMatchObject({ source: { x: 32, y: 0, w: 16, h: 16 } });
    expect(changes).toBe(1);
  });

  it('setSource(undefined) goes back to the whole bitmap', () => {
    const bmp = { width: 64, height: 32, close: () => {} } as unknown as ImageBitmap;
    const w = createImage({
      id: 'i', x: 0, y: 0, w: 16, h: 16, image: bmp, source: { x: 16, y: 0, w: 16, h: 16 },
    });
    w.setSource(undefined);
    expect((w.draw(ctx)[0] as { source?: unknown }).source).toBeUndefined();
  });

  it('setFlip leaves an omitted axis alone', () => {
    const bmp = { width: 64, height: 32, close: () => {} } as unknown as ImageBitmap;
    const w = createImage({ id: 'i', x: 0, y: 0, w: 16, h: 16, image: bmp, flipY: true });
    w.setFlip({ x: true });
    expect(w.draw(ctx)[0]).toMatchObject({ flipX: true, flipY: true });
    w.setFlip({ y: false });
    expect(w.draw(ctx)[0]).toMatchObject({ flipX: true, flipY: false });
  });

  it('setFlip notifies', () => {
    const bmp = { width: 64, height: 32, close: () => {} } as unknown as ImageBitmap;
    let changes = 0;
    const w = createImage({
      id: 'i', x: 0, y: 0, w: 16, h: 16, image: bmp, onChange: () => { changes++; },
    });
    w.setFlip({ x: true });
    expect(changes).toBe(1);
  });

  it('throws when mutating source or flip after dispose', () => {
    const bmp = { width: 64, height: 32, close: () => {} } as unknown as ImageBitmap;
    const w = createImage({ id: 'i', x: 0, y: 0, w: 16, h: 16, image: bmp });
    w.dispose();
    expect(() => w.setSource({ x: 0, y: 0, w: 1, h: 1 })).toThrow(/disposed/);
    expect(() => w.setFlip({ x: true })).toThrow(/disposed/);
  });
});
