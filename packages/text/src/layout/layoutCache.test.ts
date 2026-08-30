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
    fill: { fill: 'solid', color: '#000' }, letterSpacing: 0,
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
    const ruled = cachedLayoutRuns([{ ...run('hello world'), underline: true }], OPTS);
    const over = cachedLayoutRuns([{ ...run('hello world'), overline: true }], OPTS);
    const raised = cachedLayoutRuns([{ ...run('hello world'), baselineShift: 4 }], OPTS);
    const other = cachedLayoutRuns([{ ...run('hello world'), fill: { fill: 'solid', color: '#f00' } }], OPTS);
    for (const variant of [bigger, tracked, bold, ruled, over, raised, other]) {
      expect(variant).not.toBe(base);
    }
  });

  it('does not let one run\'s text run into the next field', () => {
    // The two author-supplied strings are length-prefixed for this: a text of
    // `'a|4:sans'` against family `'sans'` must not serialize the same as a
    // text of `'a'` against a family that swallowed the rest.
    const a = cachedLayoutRuns([{ ...run('a|4:sans'), fontFamily: 'inter' }], OPTS);
    const b = cachedLayoutRuns([{ ...run('a'), fontFamily: '|4:sansinter' }], OPTS);
    expect(b).not.toBe(a);
  });

  it('does not key on position — the layout survives a drag', () => {
    // The reason `layoutRuns` emits origin-relative geometry: with position in
    // the key, every frame of a drag was a full miss (0.130 ms against a
    // 1.7e-4 ms hit for 500 wrapped glyphs — the cost of having no cache).
    // `drawText` translates at upload, so there is nothing here to key on.
    const runs = [run('hello world')];
    const a = cachedLayoutRuns(runs, OPTS);
    for (let i = 0; i < 100; i++) expect(cachedLayoutRuns(runs, OPTS)).toBe(a);
  });

  it('re-lays out when wrapping, leading or alignment change', () => {
    const runs = [run('hello world this wraps')];
    const base = cachedLayoutRuns(runs, OPTS);
    expect(cachedLayoutRuns(runs, { ...OPTS, maxWidth: 80 })).not.toBe(base);
    expect(cachedLayoutRuns(runs, { ...OPTS, lineHeight: 2 })).not.toBe(base);
    expect(cachedLayoutRuns(runs, { ...OPTS, align: 'center' })).not.toBe(base);
  });

  describe('the outline threshold', () => {
    // `outlineMinSize` is derived from the view zoom, so a naive key would
    // miss on every frame of a pinch. It enters `layoutRuns` through exactly
    // one comparison — `run.fontSize < min` — so the key can record which
    // runs clear the bar rather than the raw number, and stay a hit across
    // every zoom that doesn't actually cross a glyph size.
    it('holds across a zoom change that crosses no run size', () => {
      const runs = [run('hello', 16)];
      const a = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 40 });
      const b = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 30 });
      expect(b).toBe(a);
    });

    it('re-lays out when the threshold crosses a run size', () => {
      const runs = [run('hello', 16)];
      const above = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 20 });
      const below = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 12 });
      expect(below).not.toBe(above);
    });

    it('distinguishes "no threshold" from a threshold above every run', () => {
      // Measurement callers (`measureTextBounds`, `textLineBoxes`) leave it
      // unset. That must not collide with a paint whose threshold happens to
      // exclude everything, even though today they lay out the same.
      const runs = [run('hello', 16)];
      const unset = cachedLayoutRuns(runs, OPTS);
      const excluded = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 999 });
      expect(excluded).not.toBe(unset);
    });

    it('tracks each distinct size in a mixed-size run list', () => {
      const runs = [run('small ', 10), run('big', 40)];
      const none = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 50 });
      const justBig = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 20 });
      const both = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 5 });
      expect(justBig).not.toBe(none);
      expect(both).not.toBe(justBig);
      // And each stays reachable.
      expect(cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 20 })).toBe(justBig);
    });
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
    // Wholesale eviction, matching outlineMeshCache's policy: without a cap
    // the map hanging off a live node grows with every distinct option set.
    // The layout itself survives the clear — the structural map still holds
    // it — so what the cap actually costs is the key build, not a re-layout.
    const runs = [run('hello world')];
    const first = cachedLayoutRuns(runs, OPTS);
    for (let i = 1; i <= LAYOUT_CACHE_VARIANT_LIMIT; i++) {
      cachedLayoutRuns(runs, { ...OPTS, maxWidth: 400 + i });
    }
    expect(cachedLayoutRuns(runs, OPTS)).toBe(first);
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
});
