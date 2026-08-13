/**
 * Text layout: `layoutRuns` against glyph count, run count and wrapping, plus
 * the `layoutCache` hit/miss split.
 *
 * `layoutRuns` walks every codepoint, resolves a face per run, kerns,
 * measures, wraps, aligns and emits a quad. It is the derivation the layout
 * cache exists to avoid, so both sides of that cache are measured here.
 *
 * The font is the repo's BMFont fixture, registered once at module load
 * against a stubbed fetch. Absolute numbers therefore describe the fixture's
 * glyph set, not any particular shipped face; the shape of the curve against
 * glyph count is the portable part.
 */
import { bench, describe } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { layoutRuns } from 'features/text/atlas/layoutRuns';
// Relative: core's `renderer/` tree has no bare path mapping (nothing inside
// core imports it by one), so there is no alias to lean on here.
import {
  cachedLayoutRuns, _resetLayoutCacheForTests,
} from '../../packages/core/src/renderer/cache/layoutCache';
import { alternatingRuns, benchFontJson, plainRun, proseOf } from './fixtures';

const ATLAS = benchFontJson();
const encoder = new TextEncoder();
globalThis.fetch = ((url: string) => {
  if (url.endsWith('.json')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(ATLAS) });
  }
  return Promise.resolve({
    ok: true,
    blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
  });
}) as unknown as typeof fetch;
globalThis.createImageBitmap = (() => Promise.resolve({
  width: 512, height: 512, close: () => {},
})) as unknown as typeof createImageBitmap;

// Top-level await, not `beforeAll`: registration has to finish before the
// suite is collected, or the first bench lays out against an empty registry
// and measures nothing.
await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
await registerFont('inter', { weight: 700 }, '/fonts/inter.json', '/fonts/inter.png');

const GLYPH_COUNTS = [50, 500, 5000];
const NO_WRAP = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
const WRAP = { maxWidth: 400, lineHeight: 1.2, align: 'left' as const };

const single = new Map(GLYPH_COUNTS.map((n) => [n, [plainRun(proseOf(n))]]));

// Guards the fixture, not the code under test. An atlas that failed to
// register lays out no quads, and every number below would silently be a
// measurement of `resolveGlyph`'s missing-glyph path instead of layout.
{
  const probe = layoutRuns([plainRun('Ag')], NO_WRAP);
  const quads = probe.groups.reduce((n, g) => n + g.quads.length, 0);
  if (quads !== 2) throw new Error(`bench font fixture: expected 2 quads, got ${quads}`);
}

describe('layoutRuns — glyph count, one run, no wrap', () => {
  for (const n of GLYPH_COUNTS) {
    const runs = single.get(n)!;
    bench(`${n} glyphs`, () => {
      layoutRuns(runs, NO_WRAP);
    });
  }
});

describe('layoutRuns — glyph count, one run, wrapped to 400px', () => {
  for (const n of GLYPH_COUNTS) {
    const runs = single.get(n)!;
    bench(`${n} glyphs`, () => {
      layoutRuns(runs, WRAP);
    });
  }
});

describe('layoutRuns — run count at a fixed 1000 glyphs', () => {
  // Same total work per glyph; what changes is how often layout switches
  // face and opens a new draw-call group.
  for (const runCount of [1, 10, 100]) {
    const runs = alternatingRuns(runCount, Math.floor(1000 / runCount));
    bench(`${runCount} ${runCount === 1 ? 'run' : 'runs'}`, () => {
      layoutRuns(runs, WRAP);
    });
  }
});

describe('layoutCache — hit vs miss (500 glyphs, wrapped)', () => {
  const runs = single.get(500)!;
  cachedLayoutRuns(runs, WRAP);
  bench('cachedLayoutRuns hit', () => {
    cachedLayoutRuns(runs, WRAP);
  });
  bench('cachedLayoutRuns miss', () => {
    _resetLayoutCacheForTests();
    cachedLayoutRuns(runs, WRAP);
  });
  // Dragging a node was a full miss on every frame while the cache keyed on
  // origin. Layout is origin-relative now and `drawText` translates at
  // upload, so this is the same call as the hit above — kept as its own row
  // because the committed baseline still holds the pre-change number, and the
  // collapse from one to the other is the result worth being able to see.
  bench('cachedLayoutRuns moving origin', () => {
    cachedLayoutRuns(runs, WRAP);
  });
});
