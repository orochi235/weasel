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
 *
 * Glyphs are in the same run as of the text merge, and they widen the class
 * rather than adding one: a font atlas is a texture in a slot like any other,
 * so a ground rect beside a label is exactly the pixel that drew olive. A
 * linear gradient widens it again: its texture is the ramp atlas, and two
 * gradients in one run are told apart only by the row each vertex names.
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
      const { WeaselRenderer, registerFont } = await import(
        /* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`
      );
      // Awaited, unlike the site's own registration: a probe that renders
      // before the atlas lands reads an empty box and passes.
      await registerFont(
        'probe', { weight: 400, style: 'normal' },
        '/weasel/inter/inter.json', '/weasel/inter/inter.png',
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

      const stops = (a: string, b: string) =>
        [{ offset: 0, color: a }, { offset: 1, color: b }];
      /** A rect filled left-to-right by a linear gradient between `x0` and
       *  `x1` — screen coordinates, the renderer having been handed an
       *  identity view. */
      const gradRect = (
        x: number, y: number, size: number,
        x0: number, x1: number, ramp: { offset: number; color: string }[],
      ) => ({
        kind: 'path',
        path: { kind: 'rect', x, y, width: size, height: size },
        fill: {
          fill: 'linear-gradient',
          from: { x: x0, y: 0 }, to: { x: x1, y: 0 },
          stops: ramp,
        },
      });

      const label = (text: string, x: number, y: number, size: number, color: string) => ({
        kind: 'text', x, y,
        runs: [{
          text, fontFamily: 'probe', fontSize: size, fontWeight: 400,
          fontStyle: 'normal', fill: { fill: 'solid', color },
          letterSpacing: 0,
          underline: false, strikethrough: false, overline: false, baselineShift: 0,
        }],
        maxWidth: Infinity, align: 'left', style: {},
      });

      /**
       * The straight-alpha color of the most opaque pixel in a box.
       *
       * Where a glyph's ink lands inside its box depends on the face, so a
       * fixed probe point is a coin flip; the darkest pixel is the one the
       * glyph definitely painted, and its color is the assertion.
       */
      function inkIn(x0: number, y0: number, x1: number, y1: number): [number, number, number] {
        const box = new Uint8Array((x1 - x0) * (y1 - y0) * 4);
        gl!.readPixels(x0, h - y1, x1 - x0, y1 - y0, gl!.RGBA, gl!.UNSIGNED_BYTE, box);
        let best = -1;
        let at = 0;
        for (let p = 0; p < box.length; p += 4) {
          if (box[p + 3] > best) { best = box[p + 3]; at = p; }
        }
        if (best <= 0) return [0, 0, 0];
        const a = best / 255;
        return [
          Math.round(box[at] / a), Math.round(box[at + 1] / a), Math.round(box[at + 2] / a),
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

      // A label between a ground and a bitmap, all in one run. The glyph's
      // atlas takes a slot, and neither neighbour may sample it.
      frame('solid and quad beside a label', [
        rect(4, 8, 32, '#ffffff'),
        label('H', 44, 4, 64, '#ff0000'),
        quad(blue, 100, 8, 32),
      ], [
        { name: 'white ground', x: 20, y: 24, want: [255, 255, 255] },
        { name: 'blue quad', x: 116, y: 24, want: [0, 0, 255] },
      ]);
      cases[cases.length - 1].probes.push({
        name: 'red glyph', x: 44, y: 4, want: [255, 0, 0], got: inkIn(40, 4, 96, 72),
      });

      // The label first, so the run adopts the atlas before anything else
      // joins — the order that broke the ground when a quad did it.
      frame('label before a solid', [
        label('H', 4, 4, 64, '#ff0000'),
        rect(60, 8, 32, '#ffffff'),
      ], [
        { name: 'white ground', x: 76, y: 24, want: [255, 255, 255] },
      ]);
      cases[cases.length - 1].probes.push({
        name: 'red glyph', x: 4, y: 4, want: [255, 0, 0], got: inkIn(0, 4, 56, 72),
      });

      // A gradient joins the run as a quad off the ramp atlas, so the atlas is
      // a texture in a slot exactly as a bitmap is — and the ground beside it
      // is the pixel that drew olive when a slot went wrong. Flat ramps here:
      // the composition is what this file guards, and a flat one reads as a
      // color rather than as a plausible neighbouring texel.
      frame('solid and quad beside a gradient', [
        rect(8, 8, 32, '#ffffff'),
        gradRect(56, 8, 32, 56, 88, stops('#00ff00', '#00ff00')),
        quad(blue, 104, 8, 32),
      ], [
        { name: 'white ground', x: 24, y: 24, want: [255, 255, 255] },
        { name: 'green gradient', x: 72, y: 24, want: [0, 255, 0] },
        { name: 'blue quad', x: 120, y: 24, want: [0, 0, 255] },
      ]);

      // Two ramps in one run, which is the atlas's own hazard: they share a
      // texture slot and are told apart only by the row each vertex names.
      frame('two gradients and a ground in one run', [
        gradRect(8, 8, 32, 8, 40, stops('#00ff00', '#00ff00')),
        rect(56, 8, 32, '#ffffff'),
        gradRect(104, 8, 32, 104, 136, stops('#ff00ff', '#ff00ff')),
      ], [
        { name: 'green gradient', x: 24, y: 24, want: [0, 255, 0] },
        { name: 'white ground', x: 72, y: 24, want: [255, 255, 255] },
        { name: 'magenta gradient', x: 120, y: 24, want: [255, 0, 255] },
      ]);

      // The ramp position rides the vertices now, so this is where a fold that
      // reversed or rescaled it shows up. The rect runs past both ends of the
      // ramp, and those clamp to the end texels exactly.
      frame('a gradient runs the way it was pointed', [
        gradRect(8, 8, 64, 24, 56, stops('#ff0000', '#0000ff')),
      ], [
        { name: 'before the ramp', x: 12, y: 24, want: [255, 0, 0] },
        // A pixel is sampled at its center, so x=40 is 16.5 of the way along a
        // ramp 32 wide — 0.5156, and 255 × (1 − 0.5156) is 123.5. The clamped
        // ends cannot catch a fold that rescaled the ramp; this one can.
        { name: 'just past halfway', x: 40, y: 24, want: [124, 0, 131] },
        { name: 'past the ramp', x: 68, y: 24, want: [0, 0, 255] },
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
