import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DiagramData } from '@weasel-js/diagram';
import { asGraph } from '../testing/asGraph';
import { docOf, graphData, runs, timeoutFor, tokenSoup } from '../pbt.fixture';
import type { DiagramDocument } from '../document';
import { DRAW_XML } from './format';

const RUNS = runs(100);
const TIMEOUT = timeoutFor(100, 60);

const write = (doc: DiagramDocument) => DRAW_XML.write!(doc).text;
const read = async (text: string) => (await DRAW_XML.read!(text)).document;
const back = async (data: DiagramData) => asGraph((await read(write(docOf(data)))).pages[0]!);

/** A cell's text as it reads back: a no-break space as a space, and blank lines at either end dropped. */
function cellText(lines: readonly string[]): string[] {
  const out = lines.join('\n').replace(/ /g, ' ').split('\n');
  while (out.length > 0 && out[0]!.trim() === '') out.shift();
  while (out.length > 0 && out.at(-1)!.trim() === '') out.pop();
  return out;
}

const label = (text: string | undefined) => {
  const lines = text === undefined ? [] : cellText([text]);
  return lines.length > 0 ? lines.join(' ') : undefined;
};

const endLabels = (ends: { from?: string; to?: string } | undefined) => {
  const from = label(ends?.from);
  const to = label(ends?.to);
  return from === undefined && to === undefined ? undefined : { ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) };
};

describe('draw-style XML, property', () => {
  it('reads back what it writes: ids, text, outlines, places, edges, and labels', async () => {
    await fc.assert(fc.asyncProperty(graphData({ placed: true, endLabels: true }), async (data) => {
      const p = await back(data);
      expect(p.data.nodes.map((n) => [n.id, n.lines, n.outline, n.at, n.width, n.height])).toEqual(
        data.nodes.map((n) => [n.id, cellText(n.lines!), n.outline, n.at, n.width, n.height]),
      );
      expect(p.data.edges.map((e) => [e.from, e.to, e.label, e.endLabels])).toEqual(
        data.edges.map((e) => [e.from, e.to, label(e.label), endLabels(e.endLabels)]),
      );
    }), RUNS);
  }, TIMEOUT);

  it('writes what it read as it was written: writing is a fixed point after one read', async () => {
    await fc.assert(fc.asyncProperty(graphData({ placed: true, endLabels: true, ports: true }), async (data) => {
      const once = write(await read(write(docOf(data))));
      expect(write(await read(once))).toBe(once);
      expect(DRAW_XML.detect(once)).toBe(true);
    }), RUNS);
  }, TIMEOUT);

  it('reads any text to a diagram, or rejects with an error', async () => {
    const tally = { read: 0, refused: 0 };
    const cell = fc.tuple(
      fc.constantFrom('<mxCell id="a" vertex="1" parent="1">', '<mxCell id="b" edge="1" source="a" target="c" parent="1">',
        '<mxCell id="c" value="x" style="ellipse;" vertex="1" parent="a">', '<mxCell id="0"/>', '<mxCell id="1" parent="0"/>',
        '<mxCell id="d" value="&lt;b&gt;y&lt;/b&gt;" style="html=1;swimlane;" vertex="1" parent="1">'),
      fc.constantFrom('<mxGeometry x="1" y="2" width="3" height="4" as="geometry"/>', '<mxGeometry relative="1" as="geometry"/>',
        '<mxGeometry x="NaN" y="1e400" width="-5" as="geometry"/>', ''),
    ).map(([open, geometry]) => `${open}${geometry}</mxCell>`);
    const text = fc.oneof(
      fc.string({ maxLength: 60 }),
      tokenSoup(['<mxfile>', '</mxfile>', '<diagram name="p">', '</diagram>', '<mxGraphModel>', '</mxGraphModel>', '<root>', '</root>', '<', '>', '/>']),
      fc.array(cell, { maxLength: 6 }).map((cells) => `<mxGraphModel><root>${cells.join('')}</root></mxGraphModel>`),
    );
    await fc.assert(fc.asyncProperty(text, async (t) => {
      let doc: DiagramDocument;
      try {
        doc = await read(t);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        tally.refused++;
        return;
      }
      tally.read++;
      for (const page of doc.pages) {
        for (const n of asGraph(page).data.nodes) {
          for (const v of [n.at?.x, n.at?.y, n.width, n.height]) if (v !== undefined) expect(Number.isFinite(v)).toBe(true);
        }
      }
      const once = write(await read(write(doc)));
      expect(write(await read(once))).toBe(once);
    }), RUNS);
    expect(tally.read).toBeGreaterThan(0);
    expect(tally.refused).toBeGreaterThan(0);
  }, TIMEOUT);
});
