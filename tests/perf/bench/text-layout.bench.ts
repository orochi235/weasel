/**
 * Text layout: `layoutRuns` against glyph count, run count and wrapping, plus
 * the `layoutCache` hit/miss split.
 *
 * The font is the repo's BMFont fixture, registered once at module load
 * against a stubbed fetch. Absolute numbers therefore describe the fixture's
 * glyph set, not any particular shipped face.
 */
import { group } from './group';
import { registerFont } from '@weasel-js/font';
import { layoutRuns, cachedLayoutRuns, paintRuns } from '@weasel-js/text';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
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

// Guards the fixture: an atlas that failed to register lays out no quads, and
// every number below would measure the missing-glyph path instead of layout.
{
  const runs = [plainRun('Ag')];
  const probe = paintRuns(layoutRuns(runs, NO_WRAP), runs);
  const quads = probe.groups.reduce((n, g) => n + g.quads.length, 0);
  if (quads !== 2) throw new Error(`bench font fixture: expected 2 quads, got ${quads}`);
}

group('layoutRuns — glyph count, one run, no wrap', (bench) => {
  for (const n of GLYPH_COUNTS) {
    const runs = single.get(n)!;
    bench(`${n} glyphs`, () => {
      layoutRuns(runs, NO_WRAP);
    });
  }
});

group('layoutRuns — glyph count, one run, wrapped to 400px', (bench) => {
  for (const n of GLYPH_COUNTS) {
    const runs = single.get(n)!;
    bench(`${n} glyphs`, () => {
      layoutRuns(runs, WRAP);
    });
  }
});

group('layoutRuns — run count at a fixed 1000 glyphs', (bench) => {
  // Same total work per glyph; what changes is how often layout switches
  // face and opens a new draw-call group.
  for (const runCount of [1, 10, 100]) {
    const runs = alternatingRuns(runCount, Math.floor(1000 / runCount));
    bench(`${runCount} ${runCount === 1 ? 'run' : 'runs'}`, () => {
      layoutRuns(runs, WRAP);
    });
  }
});

group('layoutCache — hit vs miss (500 glyphs, wrapped)', (bench) => {
  const runs = single.get(500)!;
  cachedLayoutRuns(runs, WRAP);
  bench('cachedLayoutRuns hit', () => {
    cachedLayoutRuns(runs, WRAP);
  });
  // A fresh array each call, so the identity WeakMap misses and the
  // structural key is built and hit.
  bench('cachedLayoutRuns structural hit', () => {
    cachedLayoutRuns([...runs], WRAP);
  });
  bench('cachedLayoutRuns miss', () => {
    _resetLayoutCacheForTests();
    cachedLayoutRuns(runs, WRAP);
  });
  // Layout is origin-relative, so this is the same call as the hit above; the
  // row stays because the committed baseline has a row by this name.
  bench('cachedLayoutRuns moving origin', () => {
    cachedLayoutRuns(runs, WRAP);
  });
});
