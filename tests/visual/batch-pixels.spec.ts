/**
 * What a batched run actually paints, read back channel by channel.
 *
 * The rest of `tests/visual/` compares screenshots of the demos. This one
 * builds command lists by hand and reads the framebuffer, because the thing it
 * guards is invisible to a baseline: a run's *composition*. A ground rect under
 * an atlas quad is the shape the batch exists for, and in every demo the quad
 * covers the rect, so a wrong ground never reaches a pixel a baseline samples.
 * Brick-icons hit it in an afternoon — a white ground drew olive, because the
 * solid sampled the run's atlas instead of the white texel it was promised.
 *
 * So these assert numbers, not likeness: a solid keeps its color whatever else
 * shares its draw, and a quad samples its own bitmap and no other. Both hold
 * however `draw.ts` decides to break runs, which is what makes them a gate on
 * the invariant rather than on the current run-breaking rules.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const W = 240;
const H = 80;

/** One probe: a pixel to read and the straight-alpha RGB it must be. */
interface Probe {
  name: string;
  x: number;
  y: number;
  want: [number, number, number];
}

interface Case {
  name: string;
  probes: Probe[];
}

/** Channel slack. The batch path is exact arithmetic — a white texel samples to
 *  1.0 and the multiply is the identity — so this covers rounding in the blend
 *  against the cleared framebuffer, nothing more. A tint shows up as tens. */
const TOLERANCE = 2;

test('batched runs paint their own colors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { cases, glRenderer } = await page.evaluate(
    async ({ root, w, h }) => {
      const base = `/weasel/@fs${root}`;
      const { WeaselRenderer } = await import(
        /* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`
      );

      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl) throw new Error('no WebGL2 context');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = String(dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER));

      /** A flat opaque bitmap. Flat on purpose: a probe anywhere inside a quad
       *  of it must read this color, so a quad drawn from the wrong texture
       *  reads as the wrong color rather than as a plausible neighbouring
       *  texel. */
      async function flat(
        side: number, r: number, g: number, b: number,
      ): Promise<ImageBitmap> {
        const px = new ImageData(side, side);
        for (let p = 0; p < px.data.length; p += 4) {
          px.data[p] = r; px.data[p + 1] = g; px.data[p + 2] = b; px.data[p + 3] = 255;
        }
        return createImageBitmap(px);
      }

      const red = await flat(16, 255, 0, 0);
      const blue = await flat(16, 0, 0, 255);

      const renderer = new WeaselRenderer({ gl, canvas, width: w, height: h, dpr: 1 });

      const rect = (x: number, y: number, size: number, color: string) => ({
        kind: 'path',
        path: { kind: 'rect', x, y, width: size, height: size },
        fill: { fill: 'solid', color },
      });
      const quad = (image: ImageBitmap, x: number, y: number, size: number) => ({
        kind: 'image', image, x, y, w: size, h: size,
      });

      /** Read one pixel, un-premultiplying so the probe compares against the
       *  straight-alpha color the command asked for. Y is flipped: GL reads
       *  from the bottom. */
      function read(x: number, y: number): [number, number, number] {
        const out = new Uint8Array(4);
        gl!.readPixels(x, h - 1 - y, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, out);
        const a = out[3] / 255;
        if (a === 0) return [0, 0, 0];
        return [
          Math.round(out[0] / a), Math.round(out[1] / a), Math.round(out[2] / a),
        ];
      }

      const cases: { name: string; probes: unknown[] }[] = [];

      /** Render one frame and read its probes *before* the next frame clears
       *  the buffer. Reading them all at the end instead makes every case
       *  report the last frame's pixels, which looks like a total failure and
       *  says nothing. */
      function frame(
        name: string,
        commands: unknown[],
        probes: { name: string; x: number; y: number; want: [number, number, number] }[],
      ): void {
        gl!.clearColor(0, 0, 0, 0);
        gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.STENCIL_BUFFER_BIT);
        renderer.render(commands, identity);
        cases.push({
          name,
          probes: probes.map((p) => ({ ...p, got: read(p.x, p.y) })),
        });
      }

      // A solid sharing a run with an image quad. The quad is beside the rect
      // rather than over it, which is the whole point: a wall's ground shows
      // around its art, and that is the pixel no baseline samples.
      frame('solid beside a quad', [rect(8, 8, 32, '#ffffff'), quad(red, 56, 8, 32)], [
        { name: 'white ground', x: 24, y: 24, want: [255, 255, 255] },
        { name: 'red quad', x: 72, y: 24, want: [255, 0, 0] },
      ]);

      // Order reversed, so the run adopts its bitmap before the solid joins
      // rather than after.
      frame('quad before solid', [quad(red, 8, 8, 32), rect(56, 8, 32, '#ffffff')], [
        { name: 'red quad', x: 24, y: 24, want: [255, 0, 0] },
        { name: 'white ground', x: 72, y: 24, want: [255, 255, 255] },
      ]);

      // Two bitmaps in one frame, interleaved with solids — brick-icons' cell
      // is a ground, its art, and a badge stamped over it.
      frame('two bitmaps and a ground per cell', [
        rect(8, 8, 32, '#ffffff'), quad(red, 8, 8, 16), quad(blue, 24, 24, 16),
        rect(56, 8, 32, '#ffffff'), quad(red, 56, 8, 16), quad(blue, 72, 24, 16),
      ], [
        { name: 'cell 1 art', x: 12, y: 12, want: [255, 0, 0] },
        { name: 'cell 1 badge', x: 32, y: 32, want: [0, 0, 255] },
        { name: 'cell 1 ground', x: 36, y: 12, want: [255, 255, 255] },
        { name: 'cell 2 art', x: 60, y: 12, want: [255, 0, 0] },
        { name: 'cell 2 badge', x: 80, y: 32, want: [0, 0, 255] },
        { name: 'cell 2 ground', x: 84, y: 12, want: [255, 255, 255] },
      ]);

      // A solid between two draws of the same bitmap: the run breaks and
      // reopens around it, so the second quad must not inherit anything.
      frame('same bitmap either side of a solid', [
        quad(blue, 8, 8, 32), rect(56, 8, 32, '#ffffff'), quad(blue, 104, 8, 32),
      ], [
        { name: 'first quad', x: 24, y: 24, want: [0, 0, 255] },
        { name: 'ground', x: 72, y: 24, want: [255, 255, 255] },
        { name: 'second quad', x: 120, y: 24, want: [0, 0, 255] },
      ]);

      return { cases, glRenderer };
    },
    { root: repoRoot, w: W, h: H },
  );

  console.log(`\nBatch pixels — ${W}x${H} on ${glRenderer}\n`);

  const failures: string[] = [];
  for (const c of cases as unknown as (Case & { probes: (Probe & { got: number[] })[] })[]) {
    console.log(`  ${c.name}`);
    for (const p of c.probes) {
      const off = Math.max(...p.want.map((wv, i) => Math.abs(wv - p.got[i])));
      const ok = off <= TOLERANCE;
      console.log(
        `    ${ok ? 'ok  ' : 'FAIL'} ${p.name.padEnd(16)}`
        + ` want ${p.want.map((v) => String(v).padStart(3)).join(',')}`
        + `  got ${p.got.map((v) => String(v).padStart(3)).join(',')}`
        + `  off ${String(off).padStart(3)}`,
      );
      if (!ok) failures.push(`${c.name} / ${p.name}: want ${p.want} got ${p.got}`);
    }
  }
  console.log('');

  expect(errors, errors.join('\n')).toEqual([]);
  expect(failures, failures.join('\n')).toEqual([]);
});
