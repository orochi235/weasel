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
import { _resetFontRegistryForTests, registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { cachedLayoutRuns, _resetLayoutCacheForTests, LAYOUT_CACHE_VARIANT_LIMIT } from './layoutCache';
import type { ResolvedRun } from 'features/text/runs/resolveRuns';

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
    underline: false, strikethrough: false,
  };
}

const OPTS = { maxWidth: 400, lineHeight: 1.2, align: 'left' as const };
const ORIGIN = { x: 0, y: 0 };

describe('cachedLayoutRuns', () => {
  it('lays out once for the same runs, options and origin', () => {
    const runs = [run('hello world')];
    const a = cachedLayoutRuns(runs, OPTS, ORIGIN);
    const b = cachedLayoutRuns(runs, OPTS, ORIGIN);
    expect(b).toBe(a);
  });

  it('keys on the runs array identity, not its contents', () => {
    // Mirrors `WeakMap<Path, Mesh>` in cache.ts: identity is the contract, and
    // it is what makes the entry collectable with the node that owns it. The
    // painter memo (`kit:text`) is what makes that identity stable per frame.
    const a = cachedLayoutRuns([run('hello world')], OPTS, ORIGIN);
    const b = cachedLayoutRuns([run('hello world')], OPTS, ORIGIN);
    expect(b).not.toBe(a);
  });

  it('re-lays out when the origin moves', () => {
    const runs = [run('hello world')];
    const a = cachedLayoutRuns(runs, OPTS, ORIGIN);
    const b = cachedLayoutRuns(runs, OPTS, { x: 40, y: 90 });
    expect(b).not.toBe(a);
    expect(a).toBe(cachedLayoutRuns(runs, OPTS, ORIGIN));
  });

  it('re-lays out when wrapping, leading or alignment change', () => {
    const runs = [run('hello world this wraps')];
    const base = cachedLayoutRuns(runs, OPTS, ORIGIN);
    expect(cachedLayoutRuns(runs, { ...OPTS, maxWidth: 80 }, ORIGIN)).not.toBe(base);
    expect(cachedLayoutRuns(runs, { ...OPTS, lineHeight: 2 }, ORIGIN)).not.toBe(base);
    expect(cachedLayoutRuns(runs, { ...OPTS, align: 'center' }, ORIGIN)).not.toBe(base);
  });

  describe('the outline threshold', () => {
    // `outlineMinSize` is derived from the view zoom, so a naive key would
    // miss on every frame of a pinch. It enters `layoutRuns` through exactly
    // one comparison — `run.fontSize < min` — so the key can record which
    // runs clear the bar rather than the raw number, and stay a hit across
    // every zoom that doesn't actually cross a glyph size.
    it('holds across a zoom change that crosses no run size', () => {
      const runs = [run('hello', 16)];
      const a = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 40 }, ORIGIN);
      const b = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 30 }, ORIGIN);
      expect(b).toBe(a);
    });

    it('re-lays out when the threshold crosses a run size', () => {
      const runs = [run('hello', 16)];
      const above = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 20 }, ORIGIN);
      const below = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 12 }, ORIGIN);
      expect(below).not.toBe(above);
    });

    it('distinguishes "no threshold" from a threshold above every run', () => {
      // Measurement callers (`measureTextBounds`, `textLineBoxes`) leave it
      // unset. That must not collide with a paint whose threshold happens to
      // exclude everything, even though today they lay out the same.
      const runs = [run('hello', 16)];
      const unset = cachedLayoutRuns(runs, OPTS, ORIGIN);
      const excluded = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 999 }, ORIGIN);
      expect(excluded).not.toBe(unset);
    });

    it('tracks each distinct size in a mixed-size run list', () => {
      const runs = [run('small ', 10), run('big', 40)];
      const none = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 50 }, ORIGIN);
      const justBig = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 20 }, ORIGIN);
      const both = cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 5 }, ORIGIN);
      expect(justBig).not.toBe(none);
      expect(both).not.toBe(justBig);
      // And each stays reachable.
      expect(cachedLayoutRuns(runs, { ...OPTS, outlineMinSize: 20 }, ORIGIN)).toBe(justBig);
    });
  });

  it('drops everything when a font becomes available', async () => {
    // The ambient input the key cannot see. Text laid out against a fallback
    // face must not keep that layout once the real face lands — it would be
    // measured with the wrong metrics forever.
    const runs = [run('hello world')];
    const before = cachedLayoutRuns(runs, OPTS, ORIGIN);
    expect(cachedLayoutRuns(runs, OPTS, ORIGIN)).toBe(before);

    await registerFont('newly-arrived', {}, '/fonts/other.json', '/fonts/other.png');

    expect(cachedLayoutRuns(runs, OPTS, ORIGIN)).not.toBe(before);
  });

  it('bounds the variants held for one runs array', () => {
    // Dragging a text node walks its origin across every frame, and each is a
    // distinct key. Without a cap that is an unbounded map hanging off a live
    // node. Wholesale eviction, matching outlineMeshCache's policy.
    const runs = [run('hello world')];
    const first = cachedLayoutRuns(runs, OPTS, ORIGIN);
    for (let i = 1; i <= LAYOUT_CACHE_VARIANT_LIMIT; i++) {
      cachedLayoutRuns(runs, OPTS, { x: i, y: 0 });
    }
    expect(cachedLayoutRuns(runs, OPTS, ORIGIN)).not.toBe(first);
  });
});
