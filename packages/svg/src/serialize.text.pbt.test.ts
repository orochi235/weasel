/** The exporter on text runs: every character and the style it takes through `serializeSvg` and `parseSvg`. */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';
import { color, runs, timeoutFor } from './pbt.fixture';

const N = 120;

/** Characters XML 1.0 cannot hold, which the writer replaces; a vertical tab or form feed becomes a line break. */
const NOT_XML = /[\u0000-\u0008\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const written = (s: string): string => s.replace(/[\u000B\u000C]/g, '\n').replace(new RegExp(NOT_XML, 'g'), '\uFFFD');

const chars = fc.constantFrom('a', 'b', ' ', '\n', '\t', '\r', '&', '<', '>', '"', "'", '\u00e9', '\u4e2d', '\u{1F600}',
  '\u00a0', '\u2028', '\u000B', '\u0001', '\u0000', '\uD800', '\uDC00', '\uFFFE');
const run = fc.record({
  text: fc.string({ unit: chars, minLength: 1, maxLength: 6 }),
  bold: fc.option(fc.constant(true), { nil: undefined }),
  italic: fc.option(fc.constant(true), { nil: undefined }),
  underline: fc.option(fc.constant(true), { nil: undefined }),
  fontSize: fc.option(fc.integer({ min: 4, max: 40 }), { nil: undefined }),
  fill: fc.option(color.map((c) => ({ paint: { kind: 'solid' as const, color: c } })), { nil: undefined }),
});
const textNode = fc.record({ runs: fc.array(run, { minLength: 1, maxLength: 4 }), fontSize: fc.integer({ min: 4, max: 40 }), fill: color })
  .map(({ runs: rs, fontSize, fill }): SvgTextNode => ({
    kind: 'text', x: 1, y: 2, width: 100, height: 40, text: rs.map((r) => r.text).join(''),
    style: { fontSize, fontFamily: 'Inter' }, fill: { paint: { kind: 'solid', color: fill } },
    runs: rs.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as { text: string }),
  }));

/** Each character as drawn, line breaks aside (a break's own style draws nothing): it and the style it takes. */
function styledChars(t: SvgTextNode, text: (s: string) => string = (s) => s): unknown[] {
  return (t.runs ?? [{ text: t.text }]).flatMap((r) => Array.from(text(r.text)).filter((ch) => ch !== '\n').map((ch) => [
    ch, r.bold ?? false, r.italic ?? false, r.underline ?? false, r.fontSize ?? t.style?.fontSize, r.fill ?? t.fill,
  ]));
}

describe('serializeSvg on text runs, property', () => {
  it('keeps every character and the style each takes, writing U+FFFD for any XML cannot hold, and warning', () => {
    let replaced = 0;
    fc.assert(fc.property(textNode, (t) => {
      const said: string[] = [];
      const xml = serializeSvg([t], { onWarn: (w) => said.push(w) });
      const out = parseSvg(xml);
      expect(out.warnings, xml).toEqual([]);
      const back = out.nodes[0] as SvgTextNode;
      // Each run is written on its own, so a pair split across two is two halves.
      expect(back.text, xml).toBe(t.runs!.map((r) => written(r.text)).join(''));
      expect(styledChars(back), xml).toEqual(styledChars(t, written));
      const lossy = t.runs!.some((r) => NOT_XML.test(r.text));
      if (lossy) replaced++;
      expect(said.some((w) => w.includes('U+FFFD')), xml).toBe(lossy);
    }), runs(N));
    expect(replaced).toBeGreaterThan(runs(N).numRuns / 10);
  }, timeoutFor(N, 20));
});
