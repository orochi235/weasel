/**
 * Moving text must not change how it is drawn, only where.
 *
 * `layoutRuns` emits origin-relative geometry and `drawText` translates at
 * upload, which is what lets `layoutCache` ignore position and stay a hit
 * through a drag (0.130 ms/frame → 1.7e-4 ms for 500 wrapped glyphs). The
 * risk that buys is a missed translate: a channel — glyph quads, the
 * synthetic-italic baseline, decoration rules, outline geometry — that reads
 * the layout as absolute and paints at the origin while everything else
 * moves. This renders the same text at a spread of positions and asserts
 * every uploaded float lands exactly where the same text at (0, 0) would,
 * shifted.
 *
 * The comparison allows one float32 ulp at the magnitude of the largest term
 * — under 1e-5 world units here, four orders of magnitude below a subpixel
 * and seven below the error a dropped translate would produce. The slack is
 * the test's own, not the renderer's: the reference is read back out of a
 * vertex buffer, so it arrives already quantized, and offsetting *that*
 * carries a rounding error the renderer never incurs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT, registerFontOutlines, glyphOutline } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { _resetLayoutCacheForTests } from './cache/layoutCache';
import type { DrawCommand } from './DrawCommand';
import type { ResolvedRun } from 'features/text/runs/resolveRuns';

let recorder: ReturnType<typeof makeGLRecorder>;
let r: WeaselRenderer;

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    }
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    });
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');

  recorder = makeGLRecorder();
  r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  recorder.reset();
});

const RUN = (text: string, over: Partial<ResolvedRun> = {}): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#fff' }, letterSpacing: 0,
  underline: false, strikethrough: false,
  ...over,
});

/**
 * Every vertex buffer uploaded this frame, with its floats-per-vertex read off
 * the `vertexAttribPointer` that follows rather than guessed from the length —
 * text quads are 5 (x, y, u, v, baselineY), decoration rects and outline
 * meshes are 2, and several lengths are consistent with either.
 */
function uploaded(): { stride: number; data: Float32Array }[] {
  const out: { stride: number; data: Float32Array }[] = [];
  let pending: Float32Array | null = null;
  for (const call of recorder.calls) {
    if (call.name === 'bufferData') {
      const data = call.args[1];
      pending = data instanceof Float32Array ? data : null;
      continue;
    }
    if (call.name !== 'vertexAttribPointer' || pending === null) continue;
    // Byte stride; 0 means tightly packed, which for a_position is a vec2.
    const bytes = call.args[4] as number;
    out.push({ stride: bytes === 0 ? 2 : bytes / 4, data: pending });
    pending = null;
  }
  return out;
}

/** Spacing between adjacent float32 values at the largest of `vs` — the
 *  magnitude whose quantization dominates a sum of them. */
function ulp32(...vs: number[]): number {
  const m = Math.max(...vs.map(Math.abs));
  if (!(m > 0)) return 1.4e-45;
  return Math.pow(2, Math.floor(Math.log2(m)) - 23);
}

/**
 * Assert the frame just recorded is `base` translated by `(dx, dy)`.
 *
 * `u`/`v` must be untouched — a translate that leaked into a UV would sample
 * the wrong corner of the atlas — and `baselineY` must move with `y`, or the
 * synthetic-italic shear (which reads their difference) skews by the offset.
 */
function expectTranslated(
  base: { stride: number; data: Float32Array }[],
  dx: number,
  dy: number,
  label: string,
): void {
  const got = uploaded();
  expect(got.length, `${label}: buffer count`).toBe(base.length);
  expect(got.length).toBeGreaterThan(0);
  const shifted = (actual: number, was: number, d: number, what: string) => {
    const want = was + d;
    expect(
      Math.abs(actual - want) <= ulp32(want, was, d),
      `${label}: ${what} expected ${want} (±1 float32 ulp), got ${actual}`,
    ).toBe(true);
  };
  for (let b = 0; b < got.length; b++) {
    const a = base[b].data;
    const g = got[b].data;
    const stride = base[b].stride;
    expect(g.length, `${label}: buffer ${b} length`).toBe(a.length);
    for (let i = 0; i < a.length; i += stride) {
      const at = `buffer ${b} vertex ${i / stride}`;
      shifted(g[i], a[i], dx, `${at} x`);
      shifted(g[i + 1], a[i + 1], dy, `${at} y`);
      if (stride === 5) {
        expect(g[i + 2], `${label}: ${at} u`).toBe(a[i + 2]);
        expect(g[i + 3], `${label}: ${at} v`).toBe(a[i + 3]);
        shifted(g[i + 4], a[i + 4], dy, `${at} baselineY`);
      }
    }
  }
}

const ORIGINS = [
  { x: 1, y: 1 },
  { x: 0.5, y: 0.25 },
  { x: -317.75, y: 42.125 },
  { x: 240, y: -90.5 },
];

const CASES: { name: string; cmd: (x: number, y: number) => DrawCommand }[] = [
  {
    name: 'plain, unwrapped',
    cmd: (x, y) => ({
      kind: 'text', x, y, runs: [RUN('AB BA')], maxWidth: Infinity,
      align: 'left', style: {},
    } as DrawCommand),
  },
  {
    name: 'wrapped and centered',
    cmd: (x, y) => ({
      kind: 'text', x, y, runs: [RUN('AB BA AAB BBA AB')], maxWidth: 137.5,
      align: 'center', style: {},
    } as DrawCommand),
  },
  {
    name: 'right-aligned in a box',
    cmd: (x, y) => ({
      kind: 'text', x, y, runs: [RUN('AB BA AAB')], maxWidth: 220,
      align: 'right', style: {},
    } as DrawCommand),
  },
  {
    name: 'decorated and bottom-aligned',
    cmd: (x, y) => ({
      kind: 'text', x, y, height: 400, verticalAlign: 'bottom',
      runs: [RUN('AB', { underline: true, strikethrough: true }), RUN(' BA', { underline: true })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand),
  },
  {
    name: 'tracked, mixed size',
    cmd: (x, y) => ({
      kind: 'text', x, y,
      runs: [RUN('AB ', { letterSpacing: 3.7, fontSize: 17.5 }), RUN('BAAB', { fontSize: 40 })],
      maxWidth: 400, align: 'left', style: {},
    } as DrawCommand),
  },
];

describe('drawText places the layout rather than baking it', () => {
  for (const { name, cmd } of CASES) {
    it(`translates every channel: ${name}`, () => {
      r.render([cmd(0, 0)]);
      const base = uploaded();
      for (const o of ORIGINS) {
        recorder.reset();
        r.render([cmd(o.x, o.y)]);
        expectTranslated(base, o.x, o.y, `${name} @ ${JSON.stringify(o)}`);
      }
    });
  }

  it('translates tessellated outline geometry too', async () => {
    registerFontOutlines('inter', {}, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000,
        glyphD: (cp: number) => (cp === 32 ? null : 'M0 0L0.5 -0.7L1 0Z'),
      }),
    });
    glyphOutline('inter', 400, 'normal', 65);
    await new Promise<void>((res) => setTimeout(res, 0));

    // 64 clears OUTLINE_MIN_SCREEN_PX (48) at scale 1, so these glyphs are
    // tessellated rather than sampled.
    const cmd = (x: number, y: number) => ({
      kind: 'text', x, y, runs: [RUN('AB BA', { fontSize: 64 })],
      maxWidth: Infinity, align: 'left', style: {},
    } as DrawCommand);

    recorder.reset();
    r.render([cmd(0, 0)]);
    const base = uploaded();
    // Nothing here is decorated, so a stride-2 buffer can only be outline
    // geometry — without this the test would pass on the atlas tier.
    expect(base.some((b) => b.stride === 2)).toBe(true);
    expect(base.every((b) => b.stride === 2)).toBe(true);
    for (const o of ORIGINS) {
      recorder.reset();
      r.render([cmd(o.x, o.y)]);
      expectTranslated(base, o.x, o.y, `outline @ ${JSON.stringify(o)}`);
    }
  });
});
