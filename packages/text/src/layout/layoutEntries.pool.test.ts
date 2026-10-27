/** `measureRuns` into a pool: the entries are the pool's objects, rewritten, and a layout made
 *  through it does not change when the next one reuses them. */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { measureRuns, type Entry } from './layoutEntries';
import { layoutRuns } from './layoutRuns';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };

describe('measureRuns with a pool', () => {
  it('rewrites the pool in place, and allocates fresh entries without one', async () => {
    await registerFixture('inter', [{}]);
    const pool: Entry[] = [];
    const first = measureRuns([RUN_PLAIN('AB')], 4, pool);
    const second = measureRuns([RUN_PLAIN('BA')], 4, pool);
    expect(second[0]).toBe(first[0]);
    expect(second.map((e) => e.cp)).toEqual([66, 65]);
    expect(measureRuns([RUN_PLAIN('AB')], 4)[0]).not.toBe(pool[0]);
  });

  it('leaves a finished layout as it was when the next one measures', async () => {
    await registerFixture('inter', [{}]);
    const a = layoutRuns([RUN_PLAIN('AB')], OPTS);
    const before = a.lines[0].glyphs.map((g) => [g.cp, g.x, g.advance]);
    layoutRuns([RUN_PLAIN('BBBA')], OPTS);
    expect(a.lines[0].glyphs.map((g) => [g.cp, g.x, g.advance])).toEqual(before);
  });
});
