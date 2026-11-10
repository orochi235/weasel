import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { docOf, graphData, oddText, outcome, runs, timeoutFor } from './pbt.fixture';
import type { DiagramDocument } from './document';
import { DIAGRAM_FORMATS, detectFormat } from './formats';
import { DIAGRAM_JSON } from './jsonFormat';

const RUNS = runs(100);
const TIMEOUT = timeoutFor(100, 60);

const doc: fc.Arbitrary<DiagramDocument> = fc.tuple(
  fc.boolean().chain((placed) => graphData({ placed, containers: true, endLabels: true, ports: true })),
  fc.option(oddText, { nil: undefined }),
  fc.constantFrom(undefined, 'paper', 'night'),
).map(([data, name, theme]) => {
  const d = docOf(data, name !== undefined ? { name } : {});
  return theme === undefined ? { pages: d.pages } : { ...d, theme };
});

describe('formats, property', () => {
  it('reads back the native JSON document it writes, whole', () => {
    fc.assert(fc.property(doc, (d) => {
      expect((DIAGRAM_JSON.read!(DIAGRAM_JSON.write!(d).text) as { document: DiagramDocument }).document).toEqual(d);
    }), RUNS);
  }, TIMEOUT);

  it('recognizes what each format writes as that format alone, and reads it with that format', async () => {
    await fc.assert(fc.asyncProperty(doc, async (d) => {
      for (const format of DIAGRAM_FORMATS) {
        const { text } = format.write!(d);
        expect(DIAGRAM_FORMATS.filter((f) => f.detect(text)).map((f) => f.id)).toEqual([format.id]);
        expect(detectFormat(text, `a${format.extensions[0]}`)).toBe(format);
      }
    }), RUNS);
  }, TIMEOUT);

  it('reads any JSON claiming to be a document to a document, or throws an error', () => {
    const tally = { read: 0, refused: 0 };
    const claim = fc.record({
      format: fc.constantFrom('weasel-diagram', 'weasel-diagram', 'other'),
      version: fc.oneof(fc.constantFrom(0, 1, 2, -1, 1.5), fc.jsonValue()),
      pages: fc.oneof(fc.array(fc.oneof(fc.jsonValue(), fc.record({ id: fc.string(), kind: fc.constantFrom('graph', 'plot', 'x') }))), fc.jsonValue()),
    }, { requiredKeys: ['format'] });
    const text = fc.oneof(claim.map((c) => JSON.stringify(c)), fc.string({ maxLength: 40 }), fc.jsonValue().map((v) => JSON.stringify(v)));
    fc.assert(fc.property(text, (t) => {
      const r = outcome(() => DIAGRAM_JSON.read!(t) as { document: DiagramDocument });
      if ('error' in r) {
        tally.refused++;
        expect(r.error).toMatch(/^(Not a weasel diagram document|A weasel diagram document)/);
        return;
      }
      tally.read++;
      for (const p of r.value.document.pages) expect(typeof p === 'object' && p !== null && typeof p.kind === 'string').toBe(true);
    }), RUNS);
    expect(tally.read).toBeGreaterThan(0);
    expect(tally.refused).toBeGreaterThan(0);
  }, TIMEOUT);
});
