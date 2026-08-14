/**
 * Renderer draw loop: frame cost against commands per frame, under real GL.
 *
 * The `tests/bench/` suite cannot reach this — the draw loop needs a WebGL2
 * context, so it runs in a browser, driven by Playwright. Confirm what you are
 * measuring on before reading anything into a number: the spec logs the
 * unmasked GL renderer, and a software backend (SwiftShader) reports numbers
 * that have nothing to do with a GPU.
 *
 * What it separates:
 *   - **Per-command cost, across the sweep.** Reported as the marginal cost of
 *     each step rather than one slope, because the cost per command is not
 *     constant: it holds around 1–2 us to a few hundred commands and then
 *     jumps to roughly 66 us and stays there. A single line fitted through
 *     that averages the two regimes together and reports neither.
 *   - **Program switches.** The same count runs twice — one fill kind
 *     throughout, then solid and linear-gradient alternating so consecutive
 *     commands need different programs. Switching was the suspected cliff, and
 *     it is not: alternating measures *cheaper* per command, because only the
 *     solid half pays. Whatever the threshold is, gradients do not trip it.
 *   - **Submit vs. complete.** `render()` returns once commands are issued.
 *     Each case is timed bare (what blocks the main thread) and again with a
 *     following `gl.finish()` (what the frame actually costs). They track each
 *     other closely, so the cost is CPU-side submission, not GPU work.
 *
 * **Sampling is min, not median.** Frame times here are strongly bimodal — a
 * fast cluster and a cluster near multiples of the display interval, because
 * the browser throttles and the GPU queue is shared. A median lands wherever
 * the throttling did and swings 20x run to run; the min is the clean frame and
 * is stable. Detaching the canvas from the DOM reduces the effect but does not
 * remove it.
 *
 * This reports; it does not gate. The assertions cover crash-freedom and that
 * the sweep scales at all — a timing threshold on a shared runner would flake,
 * and `tests/bench/README.md` explains why this repo does not write those.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Commands per frame. Closely spaced through the low hundreds because that
 *  is where the per-command cost changes character. */
const COUNTS = [0, 100, 250, 500, 750, 1000, 2000, 4000];
const FRAMES = 25;
const GROUPS = ['one fill kind', 'alternating fills'] as const;

interface Row { label: string; count: number; submitMs: number; frameMs: number }

/**
 * Marginal cost of the commands added since the previous step, in us. A single
 * `fixed + perCmd x n` fit is NOT used on purpose: the cost per command is not
 * constant across the sweep, and fitting a line to it hides the one thing the
 * sweep is for by averaging the cheap region into the expensive one. (It also
 * returns a negative fixed cost, which is the giveaway.)
 */
function marginalUsPerCmd(rows: Row[], i: number, pick: (r: Row) => number): number | null {
  if (i === 0) return null;
  const dN = rows[i].count - rows[i - 1].count;
  return dN === 0 ? null : ((pick(rows[i]) - pick(rows[i - 1])) * 1000) / dN;
}

test.setTimeout(240_000);

test('draw loop: frame cost vs commands per frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { rows, glRenderer, coverage } = await page.evaluate(
    async ({ root, counts, frames }) => {
      const base = `/weasel/@fs${root}/packages/core/src`;
      const { WeaselRenderer } = await import(/* @vite-ignore */ `${base}/renderer/WeaselRenderer.ts`);

      const W = 800;
      const H = 600;
      // Deliberately NOT attached to the document: a composited canvas adds
      // the compositor's schedule to every measurement.
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl) throw new Error('no WebGL2 context');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer: string = dbg
        ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));

      const renderer = new WeaselRenderer({ gl, canvas, width: W, height: H, dpr: 1 });
      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

      const solid = (i: number) => ({ fill: 'solid' as const, color: i % 2 ? '#3366cc' : '#cc6633' });
      const gradient = (i: number) => ({
        fill: 'linear-gradient' as const,
        from: { x: 0, y: 0 },
        to: { x: 40, y: 40 },
        stops: [
          { offset: 0, color: i % 2 ? '#3366cc' : '#cc6633' },
          { offset: 1, color: '#ffffff' },
        ],
      });

      function build(n: number, alternate: boolean): unknown[] {
        const out: unknown[] = [];
        for (let i = 0; i < n; i++) {
          out.push({
            kind: 'path',
            path: { kind: 'rect', x: (i * 37) % (W - 40), y: (i * 53) % (H - 40), width: 36, height: 36 },
            fill: alternate && i % 2 === 1 ? gradient(i) : solid(i),
          });
        }
        return out;
      }

      function timeMin(commands: unknown[], sync: boolean): number {
        for (let i = 0; i < 5; i++) renderer.render(commands, identity);
        gl.finish();
        let best = Infinity;
        for (let f = 0; f < frames; f++) {
          const t0 = performance.now();
          renderer.render(commands, identity);
          if (sync) gl.finish();
          const dt = performance.now() - t0;
          if (dt < best) best = dt;
        }
        return best;
      }

      /** Painted pixels, so a configuration that silently draws nothing is
       *  not mistaken for a fast one. */
      function painted(): number {
        const buf = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let n = 0;
        for (let i = 3; i < buf.length; i += 4) if (buf[i] > 0) n++;
        return n;
      }

      const rows: Array<{ label: string; count: number; submitMs: number; frameMs: number }> = [];
      const coverage: Record<string, number> = {};
      for (const alternate of [false, true]) {
        const label = alternate ? 'alternating fills' : 'one fill kind';
        for (const count of counts) {
          const commands = build(count, alternate);
          rows.push({
            label,
            count,
            submitMs: timeMin(commands, false),
            frameMs: timeMin(commands, true),
          });
          if (count === counts[counts.length - 1]) coverage[label] = painted();
        }
      }
      return { rows, glRenderer, coverage };
    },
    { root: repoRoot, counts: COUNTS, frames: FRAMES },
  );

  const lines: string[] = [
    '',
    `Draw loop — min ms per frame (800x600, dpr 1) on ${glRenderer}`,
    '',
    `| commands | ${GROUPS.map((g) => `${g}: submit / frame`).join(' | ')} |`,
    `|---:|${GROUPS.map(() => '---:').join('|')}|`,
  ];
  for (const count of COUNTS) {
    const cells = GROUPS.map((g) => {
      const r = rows.find((x) => x.label === g && x.count === count)!;
      return `${r.submitMs.toFixed(3)} / ${r.frameMs.toFixed(3)}`;
    });
    lines.push(`| ${count} | ${cells.join(' | ')} |`);
  }

  lines.push('');
  lines.push('Marginal cost of each added command, us (frame, i.e. including gl.finish):');
  lines.push(`| commands | ${GROUPS.join(' | ')} |`);
  lines.push(`|---:|${GROUPS.map(() => '---:').join('|')}|`);
  const sorted = Object.fromEntries(
    GROUPS.map((g) => [g, rows.filter((r) => r.label === g).sort((a, b) => a.count - b.count)]),
  ) as Record<string, Row[]>;
  for (let i = 1; i < COUNTS.length; i++) {
    const cells = GROUPS.map((g) => {
      const v = marginalUsPerCmd(sorted[g], i, (r) => r.frameMs);
      return v === null ? '—' : v.toFixed(2);
    });
    lines.push(`| ${COUNTS[i - 1]}→${COUNTS[i]} | ${cells.join(' | ')} |`);
  }
  lines.push(`Painted pixels at ${COUNTS[COUNTS.length - 1]} commands: ${JSON.stringify(coverage)}`);
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  // Both configurations must actually paint, or a "fast" number is just a
  // frame that drew nothing.
  for (const g of GROUPS) expect(coverage[g], `${g} painted nothing`).toBeGreaterThan(0);
  // And cost has to move with command count, or the fit is fitting noise.
  for (const g of GROUPS) {
    const gr = sorted[g];
    expect(gr[gr.length - 1].frameMs, `${g}: 4000 commands should cost more than 0`)
      .toBeGreaterThan(gr[0].frameMs);
  }
});
