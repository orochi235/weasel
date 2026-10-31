/**
 * `clearRuns`: a runs array the caches have seen, refilled in place by its
 * owner. Whatever the caches held for its old content must not answer for the
 * new, and must not be read from it later.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests, _resetFallbackForTests } from '@weasel-js/font/test-seams';
import { registerFixture, stubFetch, RUN_PLAIN } from './testing/fontFixtures';
import { _resetArrayPoolForTests } from './arrayPool';
import { cachedLayoutRuns, clearRuns, _resetLayoutCacheForTests } from './layoutCache';
import { layoutRuns } from './layoutRuns';
import { cachedPaintRuns } from './paintCache';
import { entryOf } from './runsEntries';
import { resolveRunsInto, type ResolvedRun } from '../runs/resolveRuns';
import { resolveTextStyle } from '../textStyle';

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  stubFetch();
  await registerFixture('inter', [{}]);
  _resetLayoutCacheForTests();
  _resetArrayPoolForTests();
});

const OPTS = { maxWidth: 400, lineHeight: 1.2, align: 'left' as const };
const textOf = (runs: readonly ResolvedRun[]) =>
  cachedLayoutRuns(runs, OPTS, 'read').lines.flatMap((l) => l.cells.map((c) => String.fromCodePoint(c.cp))).join('');
const solid = (color: string) => ({ paint: { kind: 'solid' as const, color } });

describe('refilling a runs array in place', () => {
  it('lays out the new text, keeping the array filed under the same entry', () => {
    const runs = [RUN_PLAIN('AB 12')];
    expect(textOf(runs)).toBe('AB 12');
    const entry = entryOf(runs);
    clearRuns(runs);
    runs[0].text = 'XY 98';
    expect(textOf(runs)).toBe('XY 98');
    expect(entryOf(runs)).toBe(entry);
    expect(cachedLayoutRuns(runs, OPTS, 'read').lines[0].cells)
      .toEqual(layoutRuns([RUN_PLAIN('XY 98')], OPTS).lines[0].cells);
  });

  it('lets fresh runs with the old content lay out the old text', () => {
    const runs = [RUN_PLAIN('AB 12')];
    textOf(runs);
    clearRuns(runs);
    runs[0].text = 'XY 98';
    textOf(runs);
    expect(textOf([RUN_PLAIN('AB 12')])).toBe('AB 12');
  });

  it('paints other runs on a shared layout with their own fill, not the refilled one', () => {
    const red = solid('#f00'), blue = solid('#00f');
    const a = [{ ...RUN_PLAIN('AB 12'), fill: red }];
    const b = [{ ...RUN_PLAIN('AB 12'), fill: blue }];
    const laidA = cachedLayoutRuns(a, OPTS, 'read');
    cachedPaintRuns(laidA, a, {}, 'read');
    const laidB = cachedLayoutRuns(b, OPTS, 'read');
    expect(laidB).toBe(laidA);
    clearRuns(a);
    a[0].fill = blue;
    expect(cachedPaintRuns(laidB, b, {}, 'read').groups[0].fill).toBe(blue);
  });
});

describe('resolveRunsInto', () => {
  const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 14 });

  it('rewrites the runs it is handed when their fields match, and replaces them when not', () => {
    const out = resolveRunsInto([], [{ text: 'a' }], style);
    const first = out[0];
    expect(resolveRunsInto(out, [{ text: 'b', fill: solid('#f00') }], style)).toBe(out);
    expect(out[0]).toBe(first);
    expect(out[0]).toMatchObject({ text: 'b', fill: solid('#f00'), fontFamily: 'inter', fontSize: 14 });
    resolveRunsInto(out, [{ text: 'c', rotate: 10 }], style);
    expect(out[0]).not.toBe(first);
    expect(out[0]).toMatchObject({ text: 'c', rotate: 10 });
    expect(first).toMatchObject({ text: 'b' });
  });

  it('resizes to the runs it is given', () => {
    const out = resolveRunsInto([], [{ text: 'a' }, { text: 'b' }], style);
    resolveRunsInto(out, [{ text: 'c' }], style);
    expect(out.map((r) => r.text)).toEqual(['c']);
  });
});
