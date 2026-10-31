import { describe, expect, it } from 'vitest';
import type { DiagramDocument, DiagramFormat } from './document';
import { DIAGRAM_FORMATS, detectFormat, readDocument } from './formats';
import { DIAGRAM_JSON } from './jsonFormat';
import { createScene, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '@weasel-js/diagram';
import { DIAGRAM_DOT } from './dot/format';
import { documentFromScene } from './fromScene';
import { DIAGRAM_MERMAID } from './mermaid/format';
import { MEASURE } from './testing/docScene';
import { documentSpecs } from './toScene';
import { DRAW_XML } from './drawXml/format';

const DOC: DiagramDocument = {
  pages: [{ kind: 'graph', id: 'p1', name: 'One', width: 300, height: 200, data: { nodes: [{ id: 'a', lines: ['A'], at: { x: 10, y: 20 } }], edges: [] } }],
  theme: 'paper',
};

const fake = (id: string, extensions: string[], detect: (t: string) => boolean): DiagramFormat => ({ id, name: id, extensions, detect, kinds: ['graph'] });

describe('detectFormat', () => {
  const formats = [fake('x1', ['.xml'], (t) => t.startsWith('<a')), fake('x2', ['.xml', '.x2'], (t) => t.startsWith('<'))];

  it('picks the first format whose content test passes', () => {
    expect(detectFormat('<b/>', undefined, formats)?.id).toBe('x2');
    expect(detectFormat('<a/>', undefined, formats)?.id).toBe('x1');
  });

  it('prefers, among those whose content passes, one claiming the file extension', () => {
    expect(detectFormat('<a/>', 'chart.X2', formats)?.id).toBe('x2');
  });

  it('never picks a format by extension alone', () => {
    expect(detectFormat('plain', 'chart.xml', formats)).toBeNull();
  });

  it('lists draw-style XML, known by its root element whatever the file is called', () => {
    expect(DIAGRAM_FORMATS).toContain(DRAW_XML);
    const text = DRAW_XML.write!(DOC).text;
    expect(detectFormat(text, 'chart.xml')).toBe(DRAW_XML);
    expect(detectFormat(text, 'chart.txt')).toBe(DRAW_XML);
    expect(detectFormat('<svg/>', 'chart.xml')).toBeNull();
  });

  it('lists the native JSON format', () => {
    expect(DIAGRAM_FORMATS).toContain(DIAGRAM_JSON);
    expect(detectFormat(DIAGRAM_JSON.write!(DOC).text)).toBe(DIAGRAM_JSON);
  });
});

describe('readDocument', () => {
  it('reads with the detected format', async () => {
    const { document, warnings } = await readDocument(DIAGRAM_JSON.write!(DOC).text, 'a.diagram.json');
    expect(document).toEqual(DOC);
    expect(warnings).toEqual([]);
  });

  it('throws on text no format reads', async () => {
    await expect(readDocument('hello', 'a.txt')).rejects.toThrow(/not a diagram file/i);
  });
});

describe('the graph formats', () => {
  it('are listed, and each file finds its own', () => {
    expect(DIAGRAM_FORMATS).toEqual(expect.arrayContaining([DIAGRAM_MERMAID, DIAGRAM_DOT]));
    expect(detectFormat('flowchart LR\nA --> B', 'a.mmd')).toBe(DIAGRAM_MERMAID);
    expect(detectFormat('digraph { a -> b }', 'a.gv')).toBe(DIAGRAM_DOT);
    expect(detectFormat('graph { a -- b }')).toBe(DIAGRAM_DOT);
    expect(detectFormat('graph TD\nA --> B')).toBe(DIAGRAM_MERMAID);
  });

  it('read to a page that draws laid out, every node placed on it', async () => {
    const { document } = await readDocument('flowchart LR\nA[One] --> B{Two} --> C((Three))', 'flow.mmd');
    const { specs, doc } = documentSpecs(document, { measure: MEASURE });
    const scene = createScene<unknown, string, RectPose>({
      systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), doc, initial: specs as never,
    });
    const page = documentFromScene(scene).pages[0]!;
    const placed = page.data.nodes;
    expect(placed.map((n) => n.id)).toEqual(['A', 'B', 'C']);
    for (const n of placed) {
      expect(n.at!.x).toBeGreaterThanOrEqual(0);
      expect(n.at!.x + n.width!).toBeLessThanOrEqual(page.width + 1);
    }
    expect(placed[0]!.at!.x).toBeLessThan(placed[1]!.at!.x);
  });
});

describe('the native JSON format', () => {
  it('refuses JSON that is not a diagram document', () => {
    expect(DIAGRAM_JSON.detect('{"pages": []}')).toBe(false);
    expect(() => DIAGRAM_JSON.read!('{"format":"weasel-diagram","version":1}')).toThrow(/pages/);
  });

  it('refuses a later version than it knows', () => {
    expect(() => DIAGRAM_JSON.read!('{"format":"weasel-diagram","version":2,"pages":[]}')).toThrow(/version 2/);
  });
});
