/**
 * What building an image's mipmaps costs the frame that first draws it small,
 * under `imageMinification: 'auto'`.
 *
 * Each sample is a fresh renderer: the bitmap is uploaded by a frame drawing it
 * at its own size, then timed over two frames drawing it at a quarter, the
 * first of which builds the mipmaps. Each frame ends in a one-pixel readback,
 * so its time includes the GPU's work. `build` is the first frame less the second.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { isolate } from './lib/isolate';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const SIDES = (process.env.WEASEL_PERF_SIDES ?? '1024,2048,4096').split(',').map(Number);
const RUNS = rounds(5);

test.setTimeout(600_000);

test('mipmap build: the frame that first draws an image small', async ({ page }) => {
  const run = startRun('mipmap-build', { sides: SIDES.join(','), runs: RUNS });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const total = SIDES.length * RUNS;
  let index = 0;
  for (const side of SIDES) {
    const first: number[] = [];
    const second: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const sample = await page.evaluate(async ({ root, side }) => {
        const { WeaselRenderer } = await import(
          /* @vite-ignore */ `/weasel/@fs${root}/packages/renderer/src/index.ts`
        );
        const data = new Uint8ClampedArray(side * side * 4);
        for (let i = 0; i < data.length; i++) data[i] = (i * 2654435761) >>> 24;
        const bitmap = await createImageBitmap(new ImageData(data, side, side));
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const gl = canvas.getContext('webgl2', { stencil: true });
        if (!gl) throw new Error('no WebGL2 context');
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        const renderer = new WeaselRenderer({ gl, width: side, height: side, dpr: 1, imageMinification: 'auto' });
        const px = new Uint8Array(4);
        const frame = (w: number): number => {
          const t0 = performance.now();
          renderer.render([{ kind: 'image', image: bitmap, x: 0, y: 0, w, h: w }]);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          return performance.now() - t0;
        };
        frame(side);
        const first = frame(side / 4);
        const second = frame(side / 4);
        renderer.dispose();
        bitmap.close();
        return { first, second, glRenderer };
      }, { root: repoRoot, side });
      run.machine({ glRenderer: sample.glRenderer });
      first.push(sample.first);
      second.push(sample.second);
      index++;
      console.log(
        `  ${String(index).padStart(2)}/${total}  ${String(side).padStart(4)}px  run ${r}`
        + `  first ${sample.first.toFixed(2).padStart(7)} ms  second ${sample.second.toFixed(2).padStart(6)} ms`,
      );
    }
    const builds = first.map((f, i) => f - second[i]);
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    run.item(`side/${side}`, {
      firstFrame: metric(median(first), 'ms', 'median', first),
      laterFrame: metric(median(second), 'ms', 'median', second),
      build: metric(median(builds), 'ms', 'median', builds),
    }, { side });
  }
  run.write();
  expect(errors).toEqual([]);
});
