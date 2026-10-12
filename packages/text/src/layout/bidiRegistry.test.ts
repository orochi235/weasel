import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { bidi } from '@weasel-js/bidi';
import { layoutRuns, type LayoutRunsOpts } from './layoutRuns';
import { cachedLayoutRuns, _resetLayoutCacheForTests } from './layoutCache';
import { layoutTextPose } from './textPoseLayout';
import { registerBidi, paragraphDirection, _resetBidiWarningForTests } from './bidiRegistry';
import type { BidiResolver } from './bidiSeam';
import type { ResolvedRun } from '../runs/resolveRuns';

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetLayoutCacheForTests();
  _resetBidiWarningForTests();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'], { type: 'image/png' })) })
  )) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/f.json', '/f.png');
});
afterEach(() => { registerBidi(null); });

const RUN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});
const OPTS: LayoutRunsOpts = { maxWidth: 400, lineHeight: 1.2, align: 'left' };
const HEBREW = 'אבג';

/** Cell indices of line `n`, sorted by where they were painted. */
const visual = (out: ReturnType<typeof layoutRuns>, n = 0): number[] => {
  const cells = out.lines[n].cells;
  return cells.map((_, i) => i).sort((a, b) => cells[a].x - cells[b].x);
};
const leftmost = (out: ReturnType<typeof layoutRuns>, n = 0): number =>
  Math.min(...out.lines[n].cells.map((c) => c.x));

describe('registerBidi', () => {
  it('reorders right-to-left text for a caller that passes no engine', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(visual(layoutRuns([RUN(HEBREW)], OPTS))).toEqual([0, 1, 2]);
    registerBidi(bidi);
    expect(visual(layoutRuns([RUN(HEBREW)], OPTS))).toEqual([2, 1, 0]);
    vi.restoreAllMocks();
  });

  it('yields to an engine passed in the options', () => {
    const logical: BidiResolver = {
      analyze: () => null,
      reorder: (_a, start, end) => ({
        order: Array.from({ length: end - start }, (_, i) => start + i),
        levels: new Uint8Array(end - start),
      }),
      mirror: () => null,
      baseLevel: () => 0,
    };
    registerBidi(bidi);
    expect(visual(layoutRuns([RUN(HEBREW)], { ...OPTS, bidi: logical }))).toEqual([0, 1, 2]);
  });

  it('hands back a function that takes the engine out again', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unregister = registerBidi(bidi);
    unregister();
    expect(visual(layoutRuns([RUN(HEBREW)], OPTS))).toEqual([0, 1, 2]);
    expect(warn.mock.calls[0][0]).toContain('registerBidi');
    warn.mockRestore();
  });

  it('says nothing about digits, which read left to right with or without an engine', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const digits = ['\u0661\u0662\u0663', '\u06f1\u06f2\u06f3', '\u{10d31}\u{10d32}', '\u{10e60}\u{10e61}', '\u0600\u066b\u066c'];
    for (const text of digits) {
      layoutRuns([RUN(text)], OPTS);
      // The premise: an engine leaves them in the order they were written.
      const levels = bidi.reorder(bidi.analyze([...text].map((c) => c.codePointAt(0)!), 'auto'), 0, [...text].length).levels;
      expect(Array.from(levels).every((l) => l % 2 === 0), text).toBe(true);
    }
    expect(warn).not.toHaveBeenCalled();
    layoutRuns([RUN('\u0627\u0661')], OPTS);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('drops a layout cached before the engine arrived', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runs = [RUN(HEBREW)];
    expect(visual(cachedLayoutRuns(runs, OPTS))).toEqual([0, 1, 2]);
    registerBidi(bidi);
    expect(visual(cachedLayoutRuns(runs, OPTS))).toEqual([2, 1, 0]);
    vi.restoreAllMocks();
  });
});

describe('layoutRuns — an omitted direction is the paragraph\'s own', () => {
  const start: LayoutRunsOpts = { ...OPTS, align: 'start' };

  it('sets a right-to-left paragraph from the right edge under `start`', () => {
    registerBidi(bidi);
    const auto = layoutRuns([RUN(HEBREW)], start);
    const right = layoutRuns([RUN(HEBREW)], { ...OPTS, align: 'right' });
    expect(leftmost(auto)).toBeGreaterThan(0);
    expect(leftmost(auto)).toBeCloseTo(leftmost(right), 10);
  });

  it('sets a left-to-right paragraph from the left edge under `start`', () => {
    registerBidi(bidi);
    expect(leftmost(layoutRuns([RUN('AB')], start))).toBe(0);
  });

  it('decides each paragraph by its own first strong character', () => {
    registerBidi(bidi);
    const out = layoutRuns([RUN(`${HEBREW}\nAB`)], start);
    expect(leftmost(out, 0)).toBeGreaterThan(0);
    expect(leftmost(out, 1)).toBe(0);
  });

  it('puts `end` on the other edge', () => {
    registerBidi(bidi);
    expect(leftmost(layoutRuns([RUN(HEBREW)], { ...OPTS, align: 'end' }))).toBe(0);
  });

  it('keeps a stated direction over the text\'s', () => {
    registerBidi(bidi);
    expect(leftmost(layoutRuns([RUN(HEBREW)], { ...start, direction: 'ltr' }))).toBe(0);
    expect(leftmost(layoutRuns([RUN('AB')], { ...start, direction: 'rtl' }))).toBeGreaterThan(0);
  });

  it('reads left to right with no engine to ask', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(leftmost(layoutRuns([RUN(HEBREW)], start))).toBe(0);
    vi.restoreAllMocks();
  });
});

describe('a text pose', () => {
  const pose = (text: string, style: object) => ({ x: 0, y: 0, width: 400, height: 40, text, style: { fontFamily: 'inter', ...style } });

  it('aligns `start` by its text when the style states no direction', () => {
    registerBidi(bidi);
    expect(leftmost(layoutTextPose(pose(HEBREW, { align: 'start' })).laid)).toBeGreaterThan(0);
    expect(leftmost(layoutTextPose(pose('AB', { align: 'start' })).laid)).toBe(0);
  });

  it('hands a stated direction to the bidi analysis', () => {
    registerBidi(bidi);
    // A neutral closing the line takes the paragraph's direction: under `rtl`
    // the `!` reads last, and so paints leftmost.
    const laid = layoutTextPose(pose('AB!', { align: 'left', direction: 'rtl' })).laid;
    expect(visual(laid)).toEqual([2, 0, 1]);
  });
});

describe('paragraphDirection', () => {
  it('is the stated direction when there is one', () => {
    expect(paragraphDirection(HEBREW, 'ltr')).toBe('ltr');
  });

  it('is the first strong character\'s under auto, with an engine', () => {
    registerBidi(bidi);
    expect(paragraphDirection(HEBREW)).toBe('rtl');
    expect(paragraphDirection(`12 ${HEBREW}`, 'auto')).toBe('rtl');
    expect(paragraphDirection('AB')).toBe('ltr');
  });

  it('answers for the first paragraph only', () => {
    registerBidi(bidi);
    expect(paragraphDirection(`AB\n${HEBREW}`)).toBe('ltr');
  });

  it('is ltr with no engine', () => {
    expect(paragraphDirection(HEBREW)).toBe('ltr');
  });
});
