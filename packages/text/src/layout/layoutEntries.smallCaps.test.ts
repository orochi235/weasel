import { describe, it, expect, beforeEach } from 'vitest';
import { setFontFallbackPolicy } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { resolveRuns } from '../runs/resolveRuns';
import { DEFAULT_TEXT_FILL, resolveTextStyle } from '../textStyle';
import { stubFetch, registerFixture } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — small caps', () => {
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' } as const;
  // The fixture atlas states no heights, so small caps takes the default.
  const K = 0.7;
  const lay = (runs: Parameters<typeof resolveRuns>[0]) =>
    layoutAndPaint(resolveRuns(runs, resolveTextStyle({ fontFamily: 'inter', fontSize: 32 }, { fill: DEFAULT_TEXT_FILL })), OPTS);

  beforeEach(async () => {
    await registerFixture('inter', [{}]);
    setFontFallbackPolicy('none');
  });

  it('draws a lowercase letter as its capital at the small size, kerned at the size before it', () => {
    const out = lay([{ text: 'Ab', fontVariantCaps: 'small-caps' }]);
    const [a, b] = out.lines[0].cells;
    expect(b.cp).toBe(66);
    // A advances 23 at 32; the A→B pair kerns -1 at A's size.
    expect(b.x).toBeCloseTo(22, 9);
    expect(b.advance).toBeCloseTo(22 * K, 9);
    expect(a.advance).toBe(22);
    const [qa, qb] = out.groups[0].quads;
    expect(qb.x1 - qb.x0).toBeCloseTo(20 * K, 9);
    expect(qa.x1 - qa.x0).toBe(22);
    // Both sit on the line's one baseline.
    expect(qb.y0 + (29 - 4) * K).toBeCloseTo(qa.y0 + (29 - 4), 9);
  });

  it("holds the line at the run's full size, even when every letter is small", () => {
    const small = lay([{ text: 'b', fontVariantCaps: 'small-caps' }]).lines[0];
    const full = lay([{ text: 'B' }]).lines[0];
    expect(small.y1 - small.y0).toBe(full.y1 - full.y0);
    expect(small.baselineY).toBe(full.baselineY);
  });

  it('rules one span under a word, at the full size', () => {
    const out = lay([{ text: 'AbB', fontVariantCaps: 'small-caps', underline: true }]);
    const plain = lay([{ text: 'A', underline: true }]);
    expect(out.decorations).toHaveLength(1);
    const [rule] = out.decorations;
    expect(rule.y1 - rule.y0).toBe(plain.decorations[0].y1 - plain.decorations[0].y0);
    expect(rule.x1).toBeCloseTo(out.lines[0].x1, 9);
  });

  it('gives a letter whose capital is longer one source span across its cells', () => {
    // The fixture has no S, so the cells stand in as unserved; their spans are
    // what is under test.
    const cells = lay([{ text: 'Aß', fontVariantCaps: 'small-caps' }]).lines[0].cells;
    expect(cells.map((c) => [c.srcIndex, c.srcEnd])).toEqual([[0, 1], [1, 2], [1, 2]]);
  });
});
