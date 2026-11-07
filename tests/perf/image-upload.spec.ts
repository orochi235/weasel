/**
 * What uploading an image's ImageBitmap costs on WebGL: straight to
 * `texImage2D`, and through the scratch 2D canvas the renderer draws a bitmap
 * into first so a straight-alpha one comes out premultiplied
 * (`packages/renderer/src/gpu/webgl/premultipliedBitmap.ts`).
 *
 * Each sample is a fresh bitmap from the same pixels and a fresh texture: the
 * upload, then a one-pixel read of a framebuffer holding the texture, so its
 * time includes the GPU's copy. The variants take turns within a round, in an
 * order that rotates, so drift lands on each alike.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { isolate } from './lib/isolate';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const SIDES = (process.env.WEASEL_PERF_SIDES ?? '256,1024,4096').split(',').map(Number);
const RUNS = rounds(7);
const VARIANTS = ['direct', 'canvas', 'canvas-straight'] as const;
type Variant = typeof VARIANTS[number];

test.setTimeout(900_000);

test('image upload: a bitmap straight to texImage2D against through the 2D canvas', async ({ page }) => {
  const run = startRun('image-upload', { sides: SIDES.join(','), runs: RUNS, variants: VARIANTS.join(',') });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const total = SIDES.length * RUNS * VARIANTS.length;
  let index = 0;
  for (const side of SIDES) {
    const samples: Record<Variant, number[]> = { direct: [], canvas: [], 'canvas-straight': [] };
    for (let r = 0; r < RUNS; r++) {
      for (let v = 0; v < VARIANTS.length; v++) {
        const variant = VARIANTS[(v + r) % VARIANTS.length];
        const sample = await page.evaluate(async ({ root, side, variant }) => {
          const { withPremultipliedSource } = await import(
            /* @vite-ignore */ `/weasel/@fs${root}/packages/renderer/src/gpu/webgl/premultipliedBitmap.ts`
          );
          const w = window as unknown as { __uploadGl?: WebGL2RenderingContext; __uploadData?: Map<number, ImageData> };
          if (!w.__uploadGl) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 4;
            w.__uploadGl = canvas.getContext('webgl2')!;
            w.__uploadData = new Map();
          }
          const gl = w.__uploadGl;
          let data = w.__uploadData!.get(side);
          if (!data) {
            data = new ImageData(side, side);
            for (let i = 0; i < data.data.length; i++) data.data[i] = (i * 2654435761) >>> 24;
            w.__uploadData!.set(side, data);
          }
          const bitmap = await createImageBitmap(data, variant === 'canvas-straight' ? { premultiplyAlpha: 'none' } : {});
          (globalThis as { gc?: () => void }).gc?.();
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          const glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
          const tex = gl.createTexture();
          const fbo = gl.createFramebuffer();
          const px = new Uint8Array(4);
          const t0 = performance.now();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          const upload = (source: TexImageSource) =>
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
          if (variant === 'direct') upload(bitmap);
          else withPremultipliedSource(bitmap, upload);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
          gl.readPixels(side - 1, side - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const ms = performance.now() - t0;
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.deleteFramebuffer(fbo);
          gl.deleteTexture(tex);
          bitmap.close();
          return { ms, glRenderer };
        }, { root: repoRoot, side, variant });
        run.machine({ glRenderer: sample.glRenderer });
        samples[variant].push(sample.ms);
        index++;
        console.log(
          `  ${String(index).padStart(3)}/${total}  ${String(side).padStart(4)}px  run ${r}`
          + `  ${variant.padEnd(15)} ${sample.ms.toFixed(2).padStart(8)} ms`,
        );
      }
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const extra = samples.canvas.map((c, i) => c - samples.direct[i]);
    run.item(`side/${side}`, {
      direct: metric(median(samples.direct), 'ms', 'median', samples.direct),
      canvas: metric(median(samples.canvas), 'ms', 'median', samples.canvas),
      canvasStraight: metric(median(samples['canvas-straight']), 'ms', 'median', samples['canvas-straight']),
      extra: metric(median(extra), 'ms', 'median', extra),
    }, { side });
  }
  run.write();
  expect(errors).toEqual([]);
});
