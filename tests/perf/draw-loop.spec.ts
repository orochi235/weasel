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
 *   - **Tree shape.** A `scene` variant wraps each command in its own group,
 *     which is what `buildSceneTree` emits and therefore what the app actually
 *     renders. A flat array is the easier thing to build and the thing no
 *     consumer sends; measuring only that reported a rect-batching win of
 *     ~1,400x that `SceneCanvas` did not get any of.
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

const VARIANTS = ['solid', 'alternating', 'stacked', 'scene', 'rotated', 'meshes', 'stroked'] as const;

/** Measured in this order, reported in the order above. `alternating` outweighs
 *  the rest of the sweep put together, and the cell measured right after it
 *  paid for collecting its garbage — so it goes last, where what it leaves
 *  behind lands on nothing. */
const MEASURE_ORDER = ['solid', 'stacked', 'scene', 'rotated', 'meshes', 'stroked', 'alternating'] as const;

test.setTimeout(300_000);

test('draw loop: frame cost vs commands per frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { rows, glRenderer, gradientRamps, gcAvailable } = await page.evaluate(
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

      const M = 0, L = 1, Z = 4; // PathVerb
      /** An octagon, so the command is a tessellated mesh rather than a rect.
       *  One Path object per command, built once: `getMesh` is keyed on Path
       *  identity, and rebuilding them per frame would measure tessellation. */
      const octagon = (cx: number, cy: number, r: number): unknown => {
        const coords = new Float32Array(16);
        for (let k = 0; k < 8; k++) {
          coords[k * 2] = cx + r * Math.cos((k * Math.PI) / 4);
          coords[k * 2 + 1] = cy + r * Math.sin((k * Math.PI) / 4);
        }
        return {
          kind: 'polygon',
          commands: new Uint8Array([M, L, L, L, L, L, L, L, Z]),
          coords,
        };
      };

      function build(n: number, variant: string): unknown[] {
        const out: unknown[] = [];
        for (let i = 0; i < n; i++) {
          const spread = variant !== 'stacked';
          const x = spread ? (i * 37) % (W - 40) : 10;
          const y = spread ? (i * 53) % (H - 40) : 10;
          const cmd: Record<string, unknown> = {
            kind: 'path',
            path: variant === 'meshes'
              ? octagon(x + 18, y + 18, 18)
              : { kind: 'rect', x, y, width: 36, height: 36 },
            fill: variant === 'alternating' && i % 2 === 1 ? gradFill : solidFill(i),
          };
          if (variant === 'stroked') cmd.stroke = { width: 2, paint: { color: '#222222' } };
          if (variant === 'rotated') {
            // What `wrapNodeOutput` emits for a rotated node: its own group
            // carrying a transform, one per command.
            const t = (i % 8) * (Math.PI / 16);
            const cos = Math.cos(t);
            const sin = Math.sin(t);
            out.push({
              kind: 'group',
              transform: new Float32Array([cos, sin, 0, -sin, cos, 0, 0, 0, 1]),
              children: [cmd],
            });
          } else {
            out.push(variant === 'scene' ? { kind: 'group', children: [cmd] } : cmd);
          }
        }
        return out;
      }

      /** Total across `frames`, divided. Never time one frame. */
      function timeBlock(cmds: unknown[], frames: number): number {
        // Collect what the previous block left behind, so a major GC of the
        // whole sweep's garbage does not land inside this one. Needs
        // --js-flags=--expose-gc, which the perf config passes.
        const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
        if (collect) {
          collect({ type: 'major', execution: 'sync' });
          collect({ type: 'major', execution: 'sync' });
        }
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) renderer.render(cmds, identity);
        gl.finish();
        return (performance.now() - t0) / frames;
      }

      /**
       * Two blocks, second reported. Three warmup frames are not enough at the
       * larger counts: the first block at 3200 measured 30x the second one of
       * identical work, so whatever it pays for — collection, re-optimization
       * — is one-off and belongs outside the number.
       */
      function measure(n: number, frames: number, variant: string): number {
        const cmds = build(n, variant);
        for (let i = 0; i < 3; i++) renderer.render(cmds, identity);
        gl.finish();
        timeBlock(cmds, frames);
        return timeBlock(cmds, frames);
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
      return {
        rows, glRenderer, gradientRamps: ramps,
        gcAvailable: typeof (globalThis as { gc?: () => void }).gc === 'function',
      };
    },
    { root: repoRoot, sweep: SWEEP, variants: [...MEASURE_ORDER] },
  );

  const lines = [
    '',
    `Draw loop — 800x600, dpr 1, on ${glRenderer}`,
    `gradient fills actually ramp: ${gradientRamps}`,
    `collected between measurements: ${gcAvailable}`,
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
