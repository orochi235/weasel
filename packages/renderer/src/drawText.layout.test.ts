/**
 * `drawText` must not mutate the layout it was handed: a cached layout that
 * absorbed the `verticalAlign` shift would gain another `dy` per frame and
 * the text would slide off the page.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import type { LaidOutRuns } from '@weasel-js/text';

/** Every layout produced during a render, each with a snapshot of its state
 *  as it was returned — before `drawText` had a chance to touch it. Spied at
 *  `cachedLayoutRuns` rather than `layoutRuns`: that is what `drawText`
 *  imports, and on a cache hit the raw layout is never called at all. */
const captured: { result: LaidOutRuns; asReturned: string }[] = [];

vi.mock('@weasel-js/text', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weasel-js/text')>();
  return {
    ...actual,
    cachedLayoutRuns: (...args: Parameters<typeof actual.cachedLayoutRuns>) => {
      const result = actual.cachedLayoutRuns(...args);
      captured.push({ result, asReturned: JSON.stringify(result) });
      return result;
    },
  };
});

let recorder: ReturnType<typeof makeGLRecorder>;
let r: WeaselRenderer;

beforeEach(async () => {
  captured.length = 0;
  _resetFontRegistryForTests();
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

/** A text command whose `verticalAlign` forces a non-zero `dy` — the box is
 *  far taller than one line, so bottom-aligning it shifts every glyph. */
function bottomAlignedText(): DrawCommand {
  return {
    kind: 'text',
    x: 0,
    y: 0,
    height: 400,
    verticalAlign: 'bottom',
    runs: [{
      text: 'Ay', fontFamily: 'inter', fontSize: 32, fontWeight: 400,
      fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#fff' } },
      letterSpacing: 0, underline: true, strikethrough: false,
      overline: false, baselineShift: 0,
    }],
    align: 'left',
    style: { fontFamily: 'inter', fontSize: 32, fill: { paint: { color: '#fff' } } },
  } as DrawCommand;
}

describe('drawText and the layout it is given', () => {
  it('leaves the layout exactly as layoutRuns returned it', () => {
    r.render([bottomAlignedText()]);
    expect(captured.length).toBeGreaterThan(0);
    for (const { result, asReturned } of captured) {
      expect(JSON.stringify(result)).toBe(asReturned);
    }
  });

  it('still bottom-aligns — the offset reaches the GPU, it just is not stored', () => {
    // Guards the fix from the lazy reading of "don't mutate": dropping the
    // `dy` entirely would also leave the layout pristine, and silently
    // un-implement verticalAlign.
    r.render([bottomAlignedText()]);
    const top = uploadedGlyphYs();

    captured.length = 0;
    recorder.reset();
    const flat = bottomAlignedText() as { verticalAlign?: string };
    delete flat.verticalAlign;
    r.render([flat as DrawCommand]);
    const untranslated = uploadedGlyphYs();

    expect(top.length).toBeGreaterThan(0);
    expect(untranslated.length).toBe(top.length);
    // Bottom-aligning inside a 400-unit box pushes the glyphs down the page.
    expect(Math.min(...top)).toBeGreaterThan(Math.min(...untranslated));
  });

  it('does not drift when the same layout is drawn repeatedly', () => {
    // The failure a cache would expose: `dy` accumulating frame over frame.
    r.render([bottomAlignedText()]);
    const first = uploadedGlyphYs();
    for (let i = 0; i < 3; i++) {
      recorder.reset();
      r.render([bottomAlignedText()]);
    }
    const fourth = uploadedGlyphYs();
    expect(fourth).toEqual(first);
  });
});

describe('drawText and the alignment box', () => {
  it('aligns within cmd.width without wrapping at it', () => {
    const base = bottomAlignedText() as Extract<DrawCommand, { kind: 'text' }>;
    const cmd: DrawCommand = {
      ...base,
      verticalAlign: undefined,
      align: 'right',
      width: 400,
      runs: [{ ...base.runs[0], text: 'AB', underline: false }],
    };
    r.render([cmd]);
    const laid = captured[captured.length - 1].result;
    // 'AB' is 44 wide in the fixture, so its right edge meets 400.
    expect(laid.lines).toHaveLength(1);
    expect(laid.lines[0].x0).toBeCloseTo(356, 5);
  });

  it('runs a tab to the stops the command\'s style states', () => {
    const base = bottomAlignedText() as Extract<DrawCommand, { kind: 'text' }>;
    const cmd = (tabSize?: number): DrawCommand => ({
      ...base,
      verticalAlign: undefined,
      style: { ...base.style, ...(tabSize !== undefined ? { tabSize } : {}) },
      runs: [{ ...base.runs[0], text: '\tB', underline: false }],
    });
    r.render([cmd()]);
    const eight = captured[captured.length - 1].result.lines[0].cells[1].x;
    r.render([cmd(2)]);
    expect(captured[captured.length - 1].result.lines[0].cells[1].x).toBeCloseTo(eight / 4, 5);
  });

  it('lays each of two commands drawn in a row out with its own box and stops', () => {
    // The options handed to the layout cache are one object refilled per
    // command, so the second must not inherit what only the first stated.
    const base = bottomAlignedText() as Extract<DrawCommand, { kind: 'text' }>;
    const first: DrawCommand = {
      ...base, verticalAlign: undefined, align: 'right', width: 400,
      style: { ...base.style, tabSize: 2 }, runs: [{ ...base.runs[0], text: '\tB', underline: false }],
    };
    const second: DrawCommand = { ...base, verticalAlign: undefined, runs: [{ ...base.runs[0], text: '\tB', underline: false }] };
    r.render([second]);
    const alone = captured[captured.length - 1].result;
    r.render([first, second]);
    const [a, b] = captured.slice(-2).map((c) => c.result);
    expect(a.lines[0].x1).toBeCloseTo(400, 5);
    expect(b).toBe(alone);
    expect(b.lines[0].x0).toBe(0);
  });

  it('resolves a reading-order alignment against the command\'s direction', () => {
    const base = bottomAlignedText() as Extract<DrawCommand, { kind: 'text' }>;
    const cmd: DrawCommand = {
      ...base,
      verticalAlign: undefined,
      align: 'start',
      direction: 'rtl',
      width: 400,
      runs: [{ ...base.runs[0], text: 'AB', underline: false }],
    };
    r.render([cmd]);
    expect(captured[captured.length - 1].result.lines[0].x0).toBeCloseTo(356, 5);
  });
});

/** Y coordinates from every vertex buffer uploaded this frame. Text quads are
 *  stride-5 (x, y, u, v, baselineY); decoration rects are stride-2. Both put
 *  `y` second, which is all this needs. */
function uploadedGlyphYs(): number[] {
  const out: number[] = [];
  for (const call of recorder.calls) {
    // Either call: the text ring writes into a slot it already owns, so its
    // geometry arrives by `bufferSubData` rather than a fresh `bufferData`.
    const data = call.name === 'bufferData' ? call.args[1]
      : call.name === 'bufferSubData' ? call.args[2]
        : null;
    if (!(data instanceof Float32Array)) continue;
    for (let i = 1; i < data.length; i += 5) out.push(data[i]);
  }
  return out;
}
