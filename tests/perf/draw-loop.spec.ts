/**
 * Renderer draw loop: frame cost against commands per frame, under real GL.
 *
 * The `tests/bench/` suite cannot reach this — the draw loop needs a WebGL2
 * context, so it runs in a browser, driven by Playwright. Check what you are
 * measuring on before reading anything into a number: the spec logs the
 * unmasked GL renderer, and a software backend (SwiftShader) produces numbers
 * that say nothing about a GPU.
 *
 * What it separates:
 *   - **Cost per command, across scene sizes.** Reported per step so a change
 *     in character is visible rather than averaged away.
 *   - **Program switches.** The same count runs twice — one fill kind
 *     throughout, then solid and linear-gradient alternating so consecutive
 *     commands need different programs. Switching was the suspected cliff and
 *     is not: alternating measures *cheaper* per command, because only the
 *     solid half is expensive.
 *   - **Overdraw.** A `stacked` variant puts every rect at the same spot: the
 *     same number of draw calls over a fraction of the fragments. It costs the
 *     same, so the loop is bound by per-draw work, not fill rate.
 *
 * **Timing is the total across many frames, divided — never a single frame.**
 * `performance.now()` is clamped to ~100us without cross-origin isolation, and
 * browser throttling makes per-frame times bimodal. A median lands wherever the
 * throttling did; a min latches onto whichever frame the driver short-circuited
 * — that is what produced an earlier report of a 30x "cliff" between 250 and
 * 500 commands, which does not exist. Timing K frames as one block and dividing
 * is immune to both, and shows a flat per-command cost from 100 to 3200.
 *
 * This reports; it does not gate. `tests/bench/README.md` explains why this
 * repo does not put timing thresholds on shared runners.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Commands per frame, and how many frames to time as one block at each.
 *  Small counts need more frames to clear the clock's granularity. */
const SWEEP = [
  { n: 100, frames: 100 },
  { n: 400, frames: 50 },
  { n: 1600, frames: 25 },
  { n: 3200, frames: 25 },
];

const VARIANTS = ['solid', 'alternating', 'stacked'] as const;

test.setTimeout(300_000);

test('draw loop: frame cost vs commands per frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { rows, glRenderer, gradientRamps } = await page.evaluate(
    async ({ root, sweep, variants }) => {
      const base = `/weasel/@fs${root}/packages/core/src`;
      const { WeaselRenderer } = await import(/* @vite-ignore */ `${base}/renderer/WeaselRenderer.ts`);

      const W = 800;
      const H = 600;
      // Not attached to the document: a composited canvas puts the
      // compositor's schedule into every measurement.
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl) throw new Error('no WebGL2 context');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = String(dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER));

      const renderer = new WeaselRenderer({ gl, canvas, width: W, height: H, dpr: 1 });
      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

      const solidFill = (i: number) => ({ fill: 'solid' as const, color: i % 2 ? '#3366cc' : '#cc6633' });
      const gradFill = {
        fill: 'linear-gradient' as const,
        from: { x: 100, y: 100 }, to: { x: 200, y: 200 },
        stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
      };

      function build(n: number, variant: string): unknown[] {
        const out: unknown[] = [];
        for (let i = 0; i < n; i++) {
          const spread = variant !== 'stacked';
          out.push({
            kind: 'path',
            path: spread
              ? { kind: 'rect', x: (i * 37) % (W - 40), y: (i * 53) % (H - 40), width: 36, height: 36 }
              : { kind: 'rect', x: 10, y: 10, width: 36, height: 36 },
            fill: variant === 'alternating' && i % 2 === 1 ? gradFill : solidFill(i),
          });
        }
        return out;
      }

      /** Total across `frames`, divided. Never time one frame. */
      function measure(n: number, frames: number, variant: string): number {
        const cmds = build(n, variant);
        for (let i = 0; i < 3; i++) renderer.render(cmds, identity);
        gl.finish();
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) renderer.render(cmds, identity);
        gl.finish();
        return (performance.now() - t0) / frames;
      }

      /** Two points at opposite ends of a gradient rect. Equal values would
       *  mean the gradient never painted, which would make it look free. */
      function checkGradientRamps(): boolean {
        renderer.render([{
          kind: 'path',
          path: { kind: 'rect', x: 100, y: 100, width: 100, height: 100 },
          fill: gradFill,
        }], identity);
        gl.finish();
        const a = new Uint8Array(4);
        const b = new Uint8Array(4);
        gl.readPixels(110, H - 110, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, a);
        gl.readPixels(190, H - 190, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
        return Math.abs(a[0] - b[0]) > 20;
      }

      const ramps = checkGradientRamps();
      const rows: Array<{ variant: string; n: number; perFrameMs: number; usPerCmd: number }> = [];
      for (const variant of variants) {
        for (const { n, frames } of sweep) {
          const perFrameMs = measure(n, frames, variant);
          rows.push({
            variant,
            n,
            perFrameMs: +perFrameMs.toFixed(3),
            usPerCmd: +((perFrameMs * 1000) / n).toFixed(2),
          });
        }
      }
      return { rows, glRenderer, gradientRamps: ramps };
    },
    { root: repoRoot, sweep: SWEEP, variants: [...VARIANTS] },
  );

  const lines = [
    '',
    `Draw loop — 800x600, dpr 1, on ${glRenderer}`,
    `gradient fills actually ramp: ${gradientRamps}`,
    '',
    `| commands | ${VARIANTS.map((v) => `${v} (ms/frame · us/cmd)`).join(' | ')} |`,
    `|---:|${VARIANTS.map(() => '---:').join('|')}|`,
  ];
  for (const { n } of SWEEP) {
    const cells = VARIANTS.map((v) => {
      const r = rows.find((x) => x.variant === v && x.n === n)!;
      return `${r.perFrameMs.toFixed(2)} · ${r.usPerCmd.toFixed(1)}`;
    });
    lines.push(`| ${n} | ${cells.join(' | ')} |`);
  }
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  // A gradient that silently draws nothing would read as a free fill kind and
  // make the program-switch comparison meaningless.
  expect(gradientRamps, 'gradient fill did not ramp').toBe(true);
  for (const v of VARIANTS) {
    const gr = rows.filter((r) => r.variant === v).sort((a, b) => a.n - b.n);
    expect(gr[gr.length - 1].perFrameMs, `${v}: more commands should cost more`)
      .toBeGreaterThan(gr[0].perFrameMs);
  }
});
