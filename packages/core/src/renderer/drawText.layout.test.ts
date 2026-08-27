/**
 * `drawText` must not mutate the layout it was handed.
 *
 * This is trap 1 from the paint-caching handoff, one layer down. `drawText`
 * applies `verticalAlign` by walking `laid.groups` and doing `q.y0 += dy` —
 * fine while every frame lays the text out afresh, and silently wrong the
 * moment a layout is shared. A cached layout would gain another `dy` per
 * frame and the text would slide off the page.
 *
 * `layoutRuns` is the most expensive derivation the kit runs (25.9 ms/frame
 * for 200 wrapped paragraphs), so it *will* be cached — this pins the
 * precondition first, and it is correct on its own terms either way.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import type { LaidOutRuns } from 'features/text/atlas/layoutRuns';

/** Every layout produced during a render, each with a snapshot of its state
 *  as it was returned — before `drawText` had a chance to touch it. */
const captured: { result: LaidOutRuns; asReturned: string }[] = [];

vi.mock('features/text/atlas/layoutRuns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('features/text/atlas/layoutRuns')>();
  return {
    ...actual,
    layoutRuns: (...args: Parameters<typeof actual.layoutRuns>) => {
      const result = actual.layoutRuns(...args);
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
      fontStyle: 'normal', fill: { fill: 'solid', color: '#fff' },
      letterSpacing: 0, underline: true, strikethrough: false,
    }],
    align: 'left',
    style: { fontFamily: 'inter', fontSize: 32, fill: { color: '#fff' } },
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
