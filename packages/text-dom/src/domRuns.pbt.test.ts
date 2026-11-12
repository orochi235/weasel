/**
 * The overlay's DOM as a carrier of runs: `runsToDom` then `domToRuns` gives back the runs written, normalized, for
 * any styling and any text; small-caps pieces are only presentation, and `normalizeSmallCaps` puts back exactly what
 * `runsToDom` wrote.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_TEXT_STYLE, runsToPlainText } from '@weasel-js/text';
import { appendOverlayText, domToRuns, normalizeSmallCaps, runsToDom, type OverlayRunBase } from './domRuns';
import { applyOverlayStyle } from './overlayStyle';
import { fromUnits, runs, runsArb, tally, timeoutFor, toUnits } from './pbt.fixture';

const RUNS = 300;

const baseArb: fc.Arbitrary<OverlayRunBase & typeof DEFAULT_TEXT_STYLE> = fc.record({
  fontVariantCaps: fc.constantFrom('normal' as const, 'small-caps' as const),
  textTransform: fc.constantFrom('none' as const, 'uppercase' as const, 'capitalize' as const),
  lang: fc.constantFrom(undefined, 'tr'),
}).map((b) => ({ ...DEFAULT_TEXT_STYLE, ...b }));

let parent: HTMLDivElement;
beforeEach(() => {
  document.body.innerHTML = '';
  parent = document.createElement('div');
  document.body.appendChild(parent);
});

describe('runsToDom and domToRuns (property)', () => {
  it('reads back the runs written, normalized', () => {
    const t = tally();
    fc.assert(fc.property(runsArb(), baseArb, (rs, base) => {
      runsToDom(rs, parent, base);
      if (parent.querySelector('[data-small-caps]')) t.count('small caps');
      if (parent.querySelector('[data-break]')) t.count('break');
      if (rs.length > 1) t.count('several');
      expect(domToRuns(parent)).toEqual(fromUnits(toUnits(rs)));
    }), runs(RUNS));
    t.atLeast('small caps', 20);
    t.atLeast('break', 20);
    t.atLeast('several', 50);
  }, timeoutFor(RUNS, 10));

  it('writes nothing for normalizeSmallCaps to change, and normalizeSmallCaps writes what runsToDom does', () => {
    const t = tally();
    fc.assert(fc.property(runsArb(), baseArb, (rs, base) => {
      // The node's own small caps reach `normalizeSmallCaps` through the overlay's CSS.
      applyOverlayStyle(parent, base);
      runsToDom(rs, parent, base);
      const written = parent.innerHTML;
      expect(normalizeSmallCaps(parent, base)).toBe(false);
      expect(parent.innerHTML).toBe(written);
      // Typing leaves a run's text in plain text nodes; the pieces come back from the text alone.
      for (const span of parent.querySelectorAll<HTMLElement>('[data-run]')) {
        const text = domToRuns(span).map((r) => r.text).join('');
        if (span.querySelector('[data-small-caps]')) t.count('flattened');
        span.replaceChildren();
        appendOverlayText(span, text);
      }
      normalizeSmallCaps(parent, base);
      expect(parent.innerHTML).toBe(written);
    }), runs(RUNS));
    t.atLeast('flattened', 20);
  }, timeoutFor(RUNS, 10));

  it('keeps every code unit of the text through any base', () => {
    fc.assert(fc.property(runsArb(), baseArb, (rs, base) => {
      runsToDom(rs, parent, base);
      expect(runsToPlainText(domToRuns(parent))).toBe(runsToPlainText(rs));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 10));
});
