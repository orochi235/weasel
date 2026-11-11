import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DataContainer, DiagramData } from '@weasel-js/diagram';
import { asGraph } from './testing/asGraph';
import { docOf, graphData, idText, oddText, runs, timeoutFor } from './pbt.fixture';
import type { DiagramDocument, DiagramFormat, GraphPage } from './document';
import { DIAGRAM_FORMATS, detectFormat } from './formats';
import { DIAGRAM_JSON } from './jsonFormat';
import { DIAGRAM_DOT } from './dot/format';
import { DRAW_XML } from './drawXml/format';
import { DIAGRAM_MERMAID } from './mermaid/format';

const RUNS = runs(100);
const TIMEOUT = timeoutFor(100, 80);

const readWith = async (format: DiagramFormat, text: string) => (await format.read!(text)).document;
const throughJson = (doc: DiagramDocument) => (DIAGRAM_JSON.read!(DIAGRAM_JSON.write!(doc).text) as { document: DiagramDocument }).document;

const anyGraph = fc.boolean().chain((placed) => graphData({ placed, containers: true, endLabels: true, ports: true }));
const TEXT_FORMATS = [DIAGRAM_DOT, DRAW_XML, DIAGRAM_MERMAID];

/** A node's text as both keep it: draw-style XML drops blank lines at either end, and reads a no-break space as a space. */
function text(lines: readonly string[] | undefined): string[] {
  const out = (lines ?? []).join('\n').replace(/\u00a0/g, ' ').split('\n');
  while (out.length > 0 && out[0]!.trim() === '') out.shift();
  while (out.length > 0 && out.at(-1)!.trim() === '') out.pop();
  return out;
}

/** What two formats that keep ids both hold: each node's id and text, and each edge's ends and label. */
const shared = (page: GraphPage) => ({
  nodes: page.data.nodes.map((n) => [n.id, text(n.lines)] as const).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  edges: page.data.edges.map((e) => [e.from, e.to, text(e.label === undefined ? [] : [e.label]).join(' ') || undefined]).map((e) => JSON.stringify(e)).sort(),
});

describe('formats, across formats', () => {
  it('reads what any format wrote the same after the native JSON format holds it between', async () => {
    await fc.assert(fc.asyncProperty(anyGraph, fc.constantFrom(...TEXT_FORMATS), async (data, format) => {
      const doc = await readWith(format, format.write!(docOf(data)).text);
      expect(format.write!(throughJson(doc)).text).toBe(format.write!(doc).text);
    }), RUNS);
  }, TIMEOUT);

  it('keeps ids, text, and edges from DOT to draw-style XML and back to DOT', async () => {
    await fc.assert(fc.asyncProperty(graphData({ placed: true }), async (data) => {
      const once = await readWith(DIAGRAM_DOT, DIAGRAM_DOT.write!(docOf(data)).text);
      const xml = await readWith(DRAW_XML, DRAW_XML.write!(once).text);
      const twice = await readWith(DIAGRAM_DOT, DIAGRAM_DOT.write!(xml).text);
      expect(shared(asGraph(twice.pages[0]!))).toEqual(shared(asGraph(once.pages[0]!)));
    }), RUNS);
  }, TIMEOUT);

  it('writes each page of a document as the one-page format writes that page alone, and draw-style XML keeps every page', async () => {
    const pages = fc.array(fc.tuple(graphData({ placed: true }), fc.option(oddText, { nil: undefined })), { minLength: 1, maxLength: 3 });
    await fc.assert(fc.asyncProperty(pages, async (ps) => {
      const ids = ps.flatMap(([data]) => data.nodes.map((n) => n.id));
      fc.pre(new Set(ids).size === ids.length);
      const doc: DiagramDocument = { pages: ps.map(([data, name], i) => ({ ...docOf(data).pages[0] as GraphPage, id: `p${i}`, ...(name !== undefined ? { name } : {}) })) };
      for (const format of [DIAGRAM_DOT, DIAGRAM_MERMAID]) {
        doc.pages.forEach((page) => {
          expect(format.write!(doc, { page: page.id }).text).toBe(format.write!({ pages: [page] }).text);
        });
      }
      const xml = await readWith(DRAW_XML, DRAW_XML.write!(doc).text);
      expect(xml.pages.map((p) => [p.name, asGraph(p).data.nodes.map((n) => n.id)])).toEqual(
        doc.pages.map((p) => [p.name, asGraph(p).data.nodes.map((n) => n.id)]),
      );
    }), RUNS);
  }, TIMEOUT);

  it('writes every node of a page whose containers hold each other in a loop', async () => {
    const looped = fc.tuple(fc.uniqueArray(idText, { minLength: 3, maxLength: 7 }), fc.integer({ min: 2, max: 4 })).map(([ids, n]): DiagramData => {
      const k = Math.min(n, ids.length - 1);
      const regions = ids.slice(0, k);
      const nodes = ids.slice(k);
      const containers: DataContainer[] = regions.map((id, i) => ({
        id, role: 'container', members: [regions[(i + 1) % k]!, ...(i === 0 ? nodes : [])],
      }));
      return { nodes: nodes.map((id) => ({ id, lines: [id] })), edges: [], containers };
    });
    await fc.assert(fc.asyncProperty(looped, fc.constantFrom(...TEXT_FORMATS), async (data, format) => {
      const page = asGraph((await readWith(format, format.write!(docOf(data)).text)).pages[0]!);
      expect(page.data.nodes.length).toBe(data.nodes.length);
    }), RUNS);
  }, TIMEOUT);

  it('detects what each format writes as that format whatever the file is named', () => {
    const names = fc.constantFrom(undefined, 'a.json', 'a.drawio', 'a.xml', 'a.mmd', 'a.dot', 'a.gv', 'a.txt', 'a', '.DOT', 'A.MMD');
    fc.assert(fc.property(anyGraph, names, (data, name) => {
      for (const format of DIAGRAM_FORMATS) expect(detectFormat(format.write!(docOf(data)).text, name)).toBe(format);
    }), RUNS);
  }, TIMEOUT);
});
