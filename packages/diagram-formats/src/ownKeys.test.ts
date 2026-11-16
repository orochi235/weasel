/** Names a reader takes from a file, spelled like `Object.prototype` members, read as names it does not know. */
import { describe, expect, it } from 'vitest';
import { arrowName, markerOf as dotMarkerOf, outlineOf, shapeOf } from './dot/values';
import { markerOf as xmlMarkerOf, markerStyle } from './drawXml/mapping';
import { decodeEntities } from './graphRead';
import { DIAGRAM_MERMAID } from './mermaid/format';
import { DIAGRAM_DOT } from './dot/format';
import type { DiagramDocument, GraphPage } from './document';

const PROTO = ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__'];

const graphOf = (doc: DiagramDocument) => doc.pages[0] as GraphPage;

describe('format tables read by own key', () => {
  it('DOT shapes and arrowheads', () => {
    for (const name of PROTO) {
      expect(outlineOf(name, [])).toBeNull();
      expect(dotMarkerOf(name)).toBeUndefined();
      expect(arrowName(name)).toBeUndefined();
      expect(shapeOf(name)).toEqual({ shape: 'box', missing: true, marked: true });
    }
  });

  it('draw XML arrowheads', () => {
    for (const name of PROTO) {
      expect(xmlMarkerOf(name, undefined)).toBeUndefined();
      expect(markerStyle(name)).toBeUndefined();
    }
  });

  it('entity references', () => {
    for (const name of ['constructor', 'tostring', 'valueof']) expect(decodeEntities(`&${name};`)).toBe(`&${name};`);
  });

  it('a DOT node shaped like a prototype member reads as a box', () => {
    const { document } = DIAGRAM_DOT.read!('digraph { a [shape=constructor]; b [shape=valueOf] }');
    for (const n of graphOf(document).data.nodes) expect(typeof n.outline === 'function').toBe(false);
  });

  it('Mermaid flowchart shapes', () => {
    const { document } = DIAGRAM_MERMAID.read!('flowchart LR\n  a@{ shape: constructor }\n  b@{ shape: toString }');
    for (const n of graphOf(document).data.nodes) expect(typeof n.outline).not.toBe('function');
  });

  it('a Mermaid sequence line opening with a prototype member is no fragment', () => {
    const { document } = DIAGRAM_MERMAID.read!('sequenceDiagram\n  participant constructor\n  participant A\n  A->>constructor: hi');
    expect(document.pages).toHaveLength(1);
    expect(() => DIAGRAM_MERMAID.read!('sequenceDiagram\n  A->>B: hi\n  constructor x\n  end')).toThrow();
  });

  it('a Mermaid C4 statement named like a prototype member is dropped, not read as a boundary', () => {
    const { warnings } = DIAGRAM_MERMAID.read!('C4Context\n  constructor(a, "A")\n  Person(p, "P")');
    expect(warnings.join(' ')).toContain('constructor');
  });

  it('a Mermaid architecture icon named like a prototype member is a rounded box', () => {
    const { warnings } = DIAGRAM_MERMAID.read!('architecture-beta\n  service a(constructor)[A]');
    expect(warnings.join(' ')).toContain('constructor');
  });

  it('writes an outline named like a prototype member as a plain box', () => {
    const doc: DiagramDocument = { pages: [{ kind: 'graph', id: 'p', name: 'P', width: 100, height: 100, data: {
      nodes: PROTO.map((name, i) => ({ id: `n${i}`, lines: ['x'], outline: name, at: { x: 0, y: 0 } })), edges: [] } }] };
    expect(() => DIAGRAM_MERMAID.write!(doc)).not.toThrow();
    expect(() => DIAGRAM_DOT.write!(doc)).not.toThrow();
    expect(DIAGRAM_MERMAID.write!(doc).text).not.toContain('function');
  });
});
