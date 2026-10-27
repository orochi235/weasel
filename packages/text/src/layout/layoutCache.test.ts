/**
 * The text-layout cache, and — the part that matters — when it lets go.
 *
 * `layoutRuns` is the most expensive derivation the kit runs: 25.9 ms/frame
 * for 200 wrapped paragraphs, 9.3 for 1000 short labels. It ran per text
 * command per frame. A stale layout is a silent rendering bug (text that
 * doesn't reflow when it should), so the invalidation conditions below matter
 * more than the hit rate.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import {
  cachedLayoutRuns, _resetLayoutCacheForTests,
  LAYOUT_CACHE_VARIANT_LIMIT, LAYOUT_CACHE_STRUCTURAL_LIMIT,
} from './layoutCache';
import type { ResolvedRun } from '../runs/resolveRuns';
import type { BidiResolver } from './bidiSeam';
import { registerBidi } from './bidiRegistry';

function stubFetch() {
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
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetLayoutCacheForTests();
  stubFetch();
  await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
  // Registering a font notifies glyph-ready, which invalidates the cache —
  // so clear again, after, or every test starts one generation behind.
  _resetLayoutCacheForTests();
});

function run(text: string, fontSize = 16): ResolvedRun {
  return {
    text, fontFamily: 'inter', fontSize, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  };
}

const OPTS = { maxWidth: 400, lineHeight: 1.2, align: 'left' as const };

describe('cachedLayoutRuns', () => {
  it('lays out once for the same runs and options', () => {
    const runs = [run('hello world')];
    const a = cachedLayoutRuns(runs, OPTS);
    const b = cachedLayoutRuns(runs, OPTS);
    expect(b).toBe(a);
  });

  it('answers a fresh array from the structural key', () => {
    // The identity `WeakMap` is the renderer's fast path and nothing else's:
    // `textLineBoxes` and `caretIndexAt` resolve a style and allocate a new
    // `ResolvedRun[]` per call, so before the structural key they re-laid out
    // every text node on every pose change.
    const a = cachedLayoutRuns([run('hello world')], OPTS);
    const b = cachedLayoutRuns([run('hello world')], OPTS);
    expect(b).toBe(a);
  });

  it('separates runs that differ in any field the layout reads', () => {
    const base = cachedLayoutRuns([run('hello world')], OPTS);
    const bigger = cachedLayoutRuns([{ ...run('hello world'), fontSize: 24 }], OPTS);
    const tracked = cachedLayoutRuns([{ ...run('hello world'), letterSpacing: 3 }], OPTS);
    const bold = cachedLayoutRuns([{ ...run('hello world'), fontWeight: 700 }], OPTS);
    const raised = cachedLayoutRuns([{ ...run('hello world'), baselineShift: 4 }], OPTS);
    for (const variant of [bigger, tracked, bold, raised]) {
      expect(variant).not.toBe(base);
    }
  });

  it('shares one layout between runs that differ only in what is drawn', () => {
    const base = cachedLayoutRuns([run('hello world')], OPTS);
    const ruled = cachedLayoutRuns([{ ...run('hello world'), underline: true }], OPTS);
    const red = cachedLayoutRuns([{ ...run('hello world'), fill: { paint: { kind: 'solid', color: '#f00' } } }], OPTS);
    const stroked = cachedLayoutRuns([{ ...run('hello world'), stroke: { paint: { color: '#f00' }, width: 2 } }], OPTS);
    for (const variant of [ruled, red, stroked]) expect(variant).toBe(base);
  });

  it('does not let one run\'s text run into the next field', () => {
    // The two author-supplied strings are length-prefixed for this: a text of
    // `'a|4:sans'` against family `'sans'` must not serialize the same as a
    // text of `'a'` against a family that swallowed the rest.
    const a = cachedLayoutRuns([{ ...run('a|4:sans'), fontFamily: 'inter' }], OPTS);
    const b = cachedLayoutRuns([{ ...run('a'), fontFamily: '|4:sansinter' }], OPTS);
    expect(b).not.toBe(a);
  });

  it('re-lays out when wrapping, leading or alignment change', () => {
    const runs = [run('hello world this wraps')];
    const base = cachedLayoutRuns(runs, OPTS);
    expect(cachedLayoutRuns(runs, { ...OPTS, maxWidth: 80 })).not.toBe(base);
    expect(cachedLayoutRuns(runs, { ...OPTS, lineHeight: 2 })).not.toBe(base);
    expect(cachedLayoutRuns(runs, { ...OPTS, align: 'center' })).not.toBe(base);
  });

  it('answers each of two alternating option sets with its own layout', () => {
    // The last lookup is compared field by field before any key is built, so
    // switching back has to find the first layout, not the last one.
    const runs = [run('hello world this wraps')];
    const wide = cachedLayoutRuns(runs, OPTS);
    const narrow = cachedLayoutRuns(runs, { ...OPTS, maxWidth: 80 });
    expect(narrow).not.toBe(wide);
    expect(cachedLayoutRuns(runs, OPTS)).toBe(wide);
    expect(cachedLayoutRuns(runs, { ...OPTS, maxWidth: 80 })).toBe(narrow);
    for (const changed of [{ tabSize: 4 }, { justify: true }, { alignWidth: 200 }, { direction: 'rtl' as const }]) {
      expect(cachedLayoutRuns(runs, OPTS)).toBe(wide);
      expect(cachedLayoutRuns(runs, { ...OPTS, ...changed })).not.toBe(wide);
    }
  });

  it('lays out again when an engine is registered after a hit', () => {
    const runs = [run('ab')];
    const plain = cachedLayoutRuns(runs, OPTS);
    expect(cachedLayoutRuns(runs, OPTS)).toBe(plain);
    const unregister = registerBidi({
      analyze: () => null,
      reorder: (_a, start, end) => ({
        order: Array.from({ length: end - start }, (_, i) => end - 1 - i),
        levels: new Array<number>(end - start).fill(1),
      }),
      mirror: () => null,
      baseLevel: () => 0,
    });
    try {
      expect(cachedLayoutRuns(runs, OPTS)).not.toBe(plain);
    } finally {
      unregister();
    }
    expect(cachedLayoutRuns(runs, OPTS)).toBe(plain);
  });

  it('re-lays out when the alignment box changes, not when it restates maxWidth', () => {
    const runs = [run('hello world')];
    const base = cachedLayoutRuns(runs, { ...OPTS, align: 'center' });
    expect(cachedLayoutRuns(runs, { ...OPTS, align: 'center', alignWidth: 200 })).not.toBe(base);
    expect(cachedLayoutRuns(runs, { ...OPTS, align: 'center', alignWidth: 400 })).toBe(base);
  });

  it('drops everything when a font becomes available', async () => {
    // The ambient input the key cannot see. Text laid out against a fallback
    // face must not keep that layout once the real face lands — it would be
    // measured with the wrong metrics forever.
    const runs = [run('hello world')];
    const before = cachedLayoutRuns(runs, OPTS);
    expect(cachedLayoutRuns(runs, OPTS)).toBe(before);

    await registerFont('newly-arrived', {}, '/fonts/other.json', '/fonts/other.png');

    expect(cachedLayoutRuns(runs, OPTS)).not.toBe(before);
  });

  it('bounds the variants held for one runs array', () => {
    const runs = [run('hello world')];
    const first = cachedLayoutRuns(runs, OPTS);
    for (let i = 1; i <= LAYOUT_CACHE_VARIANT_LIMIT; i++) {
      cachedLayoutRuns(runs, { ...OPTS, maxWidth: 400 + i });
    }
    // Push the layout out of the structural map too, so only a variant the
    // array still held could answer with it.
    for (let i = 0; i < LAYOUT_CACHE_STRUCTURAL_LIMIT; i++) {
      cachedLayoutRuns([run(`text ${i}`)], OPTS);
    }
    expect(cachedLayoutRuns(runs, OPTS)).not.toBe(first);
  });

  it('bounds the structural map, evicting least-recently-used', () => {
    // Nothing collects a string key, so this side cannot ride an array's
    // lifetime the way the WeakMap does — it needs a real cap.
    const first = cachedLayoutRuns([run('text 0')], OPTS);
    for (let i = 1; i <= LAYOUT_CACHE_STRUCTURAL_LIMIT; i++) {
      cachedLayoutRuns([run(`text ${i}`)], OPTS);
    }
    expect(cachedLayoutRuns([run('text 0')], OPTS)).not.toBe(first);
  });

  it('keeps a re-read entry young', () => {
    const first = cachedLayoutRuns([run('text 0')], OPTS);
    for (let i = 1; i < LAYOUT_CACHE_STRUCTURAL_LIMIT; i++) {
      cachedLayoutRuns([run(`text ${i}`)], OPTS);
      // Touching it on every insert keeps it off the old end of the map.
      expect(cachedLayoutRuns([run('text 0')], OPTS)).toBe(first);
    }
  });

  it('does not share a layout between equal text from different sources', () => {
    const plain = cachedLayoutRuns([run('SS')], OPTS);
    const mapped = cachedLayoutRuns(
      [{ ...run('SS'), srcMap: { length: 1, starts: [0, 0], ends: [1, 1] } }], OPTS,
    );
    expect(mapped).not.toBe(plain);
    expect(mapped.lines[0].cells.map((c) => c.srcEnd)).toEqual([1, 1]);
  });

  it('does not share a layout between runs that size their glyphs differently', () => {
    const r = run('AB');
    const full = cachedLayoutRuns([r], OPTS);
    const small = cachedLayoutRuns([{ ...r, sizeMap: [r.fontSize, r.fontSize * 0.7] }], OPTS);
    expect(small).not.toBe(full);
    expect(small.lines[0].cells[1].advance).toBeLessThan(full.lines[0].cells[1].advance);
  });
});

describe('what the structural key compares', () => {
  it('matches runs equal field by field, copied maps included', () => {
    // Compared by content, not by the identity of the arrays inside a run.
    const r = { ...run('SS'), srcMap: { length: 1, starts: [0, 0], ends: [1, 1] }, sizeMap: [16, 11.2] };
    const a = cachedLayoutRuns([r], OPTS);
    const copy = { ...r, srcMap: { ...r.srcMap, starts: [0, 0], ends: [1, 1] }, sizeMap: [16, 11.2] };
    expect(cachedLayoutRuns([copy], OPTS)).toBe(a);
    expect(cachedLayoutRuns([{ ...copy, sizeMap: [16, 12] }], OPTS)).not.toBe(a);
    expect(cachedLayoutRuns([{ ...copy, srcMap: { length: 1, starts: [0, 1], ends: [1, 1] } }], OPTS)).not.toBe(a);
  });

  it('tells apart runs whose count differs and whose text splits differently', () => {
    const one = cachedLayoutRuns([run('ab')], OPTS);
    expect(cachedLayoutRuns([run('a'), run('b')], OPTS)).not.toBe(one);
    expect(cachedLayoutRuns([run('ab'), run('')], OPTS)).not.toBe(one);
  });

  it('treats an option left at its default as the default stated', () => {
    const runs = [run('hello world')];
    const base = cachedLayoutRuns(runs, OPTS);
    expect(cachedLayoutRuns(runs, { ...OPTS, tabSize: 8, direction: 'auto', justify: false })).toBe(base);
    const justified = cachedLayoutRuns(runs, { ...OPTS, align: 'justify' });
    expect(cachedLayoutRuns([run('hello world')], { ...OPTS, align: 'justify', justify: true })).toBe(justified);
  });
});

describe('what the key has to tell apart', () => {
  it('lays out again when only `direction` changes', () => {
    const runs = [run('hello')];
    const opts = { maxWidth: 400, lineHeight: 1.2, align: 'start' as const };
    const ltr = cachedLayoutRuns(runs, { ...opts, direction: 'ltr' });
    const rtl = cachedLayoutRuns(runs, { ...opts, direction: 'rtl' });
    expect(ltr.lines[0].x0).toBe(0);
    expect(rtl.lines[0].x1).toBeCloseTo(400, 6);
  });

  it('lays out again when a bidi engine is supplied, and per engine', () => {
    const engine = (): BidiResolver => ({
      analyze: () => null,
      reorder: (_a, start, end) => ({
        order: Array.from({ length: end - start }, (_, i) => end - 1 - i),
        levels: new Array<number>(end - start).fill(1),
      }),
      mirror: () => null,
      baseLevel: () => 0,
    });
    const runs = [run('ab')];
    const plain = cachedLayoutRuns(runs, OPTS);
    const first = engine();
    const reversed = cachedLayoutRuns(runs, { ...OPTS, bidi: first });
    expect(plain.lines[0].cells[0].x).toBeLessThan(plain.lines[0].cells[1].x);
    expect(reversed.lines[0].cells[0].x).toBeGreaterThan(reversed.lines[0].cells[1].x);
    expect(cachedLayoutRuns(runs, { ...OPTS, bidi: first })).toBe(reversed);
    expect(cachedLayoutRuns(runs, { ...OPTS, bidi: engine() })).not.toBe(reversed);
    // A fresh array reaches the structural key, which has to tell them apart too.
    expect(cachedLayoutRuns([run('ab')], OPTS)).toBe(plain);
  });

  it('keeps a shrunken run\'s line height apart from a plain run of the same size', () => {
    // A run scaled to 10 inside 20px text holds its line at 20; plain 10px
    // text does not. Everything else about the two runs is identical.
    const strut = cachedLayoutRuns([{ ...run('x', 10), strutSize: 20 }], OPTS);
    const plain = cachedLayoutRuns([run('x', 10)], OPTS);
    expect(strut.lines[0].y1).toBeCloseTo(24, 6);
    expect(plain.lines[0].y1).toBeCloseTo(12, 6);
  });
});
