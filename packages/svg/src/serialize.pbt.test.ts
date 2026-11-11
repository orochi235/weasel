/**
 * The exporter writes what its own reader takes without complaint: well formed, every id unique, every reference
 * to a def that exists, and nothing `parseSvg` warns about. What it draws: `serialize.paint.pbt.test.ts` and
 * `serialize.text.pbt.test.ts`, split from this one because jsdom keeps every document a file parses
 * (docs/traps/testing.md).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { runs, timeoutFor, tree } from './pbt.fixture';

const N = 120;

/** Every `id`, and every `#id` an attribute names, in `xml`. */
function idsAndRefs(xml: string): { ids: string[]; refs: string[]; doc: Document } {
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  const ids: string[] = [], refs: string[] = [];
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    for (const a of Array.from(el.attributes)) {
      if (a.localName === 'id') ids.push(a.value);
      for (const m of a.value.matchAll(/url\(\s*['"]?#([^)'"\s]+)/g)) refs.push(m[1]!);
      if (a.localName === 'href' && a.value.startsWith('#')) refs.push(a.value.slice(1));
    }
  }
  return { ids, refs, doc };
}

describe('serializeSvg, property', () => {
  it('writes a well-formed document whose ids are unique and whose every reference resolves', () => {
    let refs = 0;
    fc.assert(fc.property(tree(), (nodes) => {
      const xml = serializeSvg(nodes);
      const got = idsAndRefs(xml);
      expect(got.doc.getElementsByTagName('parsererror')).toHaveLength(0);
      expect(new Set(got.ids).size, xml).toBe(got.ids.length);
      const known = new Set(got.ids);
      for (const r of got.refs) expect(known.has(r), `#${r} in ${xml}`).toBe(true);
      refs += got.refs.length;
    }), runs(N));
    expect(refs).toBeGreaterThan(runs(N).numRuns);
  }, timeoutFor(N, 30));

  it('writes nothing its reader warns about', () => {
    fc.assert(fc.property(tree(), (nodes) => {
      const said: string[] = [];
      const xml = serializeSvg(nodes, { onWarn: (w) => said.push(w) });
      expect(said).toEqual([]);
      expect(parseSvg(xml, { keepHidden: true }).warnings, xml).toEqual([]);
    }), runs(N));
  }, timeoutFor(N, 30));
});
