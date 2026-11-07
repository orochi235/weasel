/**
 * The visual suite's `test`: Playwright's, with every `page.goto` carrying
 * `?backend=` when `WEASEL_VISUAL_BACKEND` is set, so the site paints every
 * canvas with that backend against the same baselines. Every page also gets
 * `window.weaselCanvasSnapshot` and `weaselCanvasPixels`, a spec's way to read
 * a canvas on either backend.
 */
import { test as base } from '@playwright/test';

export { expect, type Locator, type Page } from '@playwright/test';

/** The backend every canvas paints with: `WEASEL_VISUAL_BACKEND`, else WebGL 2. */
export const backend = process.env.WEASEL_VISUAL_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';

declare global {
  interface Window {
    /** A 2D context holding `canvas`'s frame: drawn straight from it on WebGL,
     *  and through `toDataURL` on WebGPU, where a 2D draw of a canvas already
     *  shown comes out transparent (CI, 2026-11-07). */
    weaselCanvasSnapshot(canvas: HTMLCanvasElement): Promise<CanvasRenderingContext2D>;
    /** `canvas`'s pixels as WebGL's `readPixels` returns them: premultiplied
     *  RGBA, rows bottom-up. Read with `readPixels` on WebGL, from
     *  `weaselCanvasSnapshot` on WebGPU. */
    weaselCanvasPixels(canvas: HTMLCanvasElement): Promise<Uint8Array>;
  }
}

/** `url` with `backend=<backend>` in its query, ahead of any hash. */
export function withBackend(url: string, backend: string): string {
  const hashAt = url.indexOf('#');
  const head = hashAt < 0 ? url : url.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : url.slice(hashAt);
  const queryAt = head.indexOf('?');
  const path = queryAt < 0 ? head : head.slice(0, queryAt);
  const query = new URLSearchParams(queryAt < 0 ? '' : head.slice(queryAt + 1));
  query.set('backend', backend);
  return `${path}?${query}${hash}`;
}

function installCanvasReaders(webgpu: boolean): void {
  window.weaselCanvasSnapshot = async (c) => {
    const snapshot = document.createElement('canvas');
    snapshot.width = c.width;
    snapshot.height = c.height;
    const ctx = snapshot.getContext('2d', { willReadFrequently: true })!;
    if (!webgpu) {
      ctx.drawImage(c, 0, 0);
      return ctx;
    }
    const image = new Image();
    image.src = c.toDataURL('image/png');
    await image.decode();
    ctx.drawImage(image, 0, 0);
    return ctx;
  };
  window.weaselCanvasPixels = async (c) => {
    const w = c.width;
    const h = c.height;
    const buf = new Uint8Array(w * h * 4);
    if (!webgpu) {
      const gl = c.getContext('webgl2')!;
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    }
    const top = (await window.weaselCanvasSnapshot(c)).getImageData(0, 0, w, h).data;
    const row = w * 4;
    for (let y = 0; y < h; y++) {
      const from = y * row;
      const to = (h - 1 - y) * row;
      for (let i = 0; i < row; i += 4) {
        const a = top[from + i + 3];
        buf[to + i] = Math.round((top[from + i] * a) / 255);
        buf[to + i + 1] = Math.round((top[from + i + 1] * a) / 255);
        buf[to + i + 2] = Math.round((top[from + i + 2] * a) / 255);
        buf[to + i + 3] = a;
      }
    }
    return buf;
  };
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(installCanvasReaders, backend === 'webgpu');
    if (process.env.WEASEL_VISUAL_BACKEND) {
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(withBackend(url, backend), options);
    }
    await use(page);
  },
});
