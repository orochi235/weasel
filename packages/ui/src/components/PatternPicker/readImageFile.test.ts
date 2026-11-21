import { afterEach, describe, expect, it, vi } from 'vitest';
import { readImageFile } from './readImageFile';

/** An `<img>` that decodes at once to the given natural size: jsdom decodes nothing. */
function stubImage(naturalWidth: number, naturalHeight: number): void {
  vi.stubGlobal('Image', class {
    src = '';
    naturalWidth = naturalWidth;
    naturalHeight = naturalHeight;
    decode() { return Promise.resolve(); }
  });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('readImageFile', () => {
  it('sizes an SVG declaring only a viewBox by the viewBox, when it decodes at no size', async () => {
    stubImage(0, 0);
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"/>'], 'wide.svg', { type: 'image/svg+xml' });
    expect(await readImageFile(file)).toMatchObject({ width: 200, height: 100 });
  });

  it('keeps the size an SVG decodes to', async () => {
    stubImage(30, 60);
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"/>'], 'tall.svg', { type: 'image/svg+xml' });
    expect(await readImageFile(file)).toMatchObject({ width: 30, height: 60 });
  });
});
