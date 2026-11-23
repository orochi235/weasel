import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { parseErDiagram } from './parse';
import { readErDiagram } from './read';
import { writeErDiagram } from './write';

const ORDERS = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'er', 'orders.mmd'), 'utf8');
const page = (text: string) => onlyPage(readErDiagram(text).document);
const node = (text: string, id: string) => page(text).data.nodes.find((n) => n.id === id) as DataNode;
const edge = (text: string, from: string, to: string) => page(text).data.edges.find((e) => e.from === from && e.to === to)!;

describe('reading a Mermaid ER diagram', () => {
  it('reads a page of notation er', () => {
    expect(page(ORDERS)).toMatchObject({ name: 'Orders schema', notation: 'er' });
  });

  it('reads an entity as its name, a divider, and a field per attribute: type, then name, keys, and comment', () => {
    expect(node(ORDERS, 'CUSTOMER').rows).toEqual([
      { kind: 'label', text: 'CUSTOMER' }, { kind: 'divider' },
      { kind: 'field', label: 'string', value: 'name' },
      { kind: 'field', label: 'string', value: 'email UK "login address"' },
      { kind: 'field', label: 'int', value: 'id PK' },
    ]);
    expect(node(ORDERS, 'LINE_ITEM').rows![3]).toEqual({ kind: 'field', label: 'int', value: 'productId PK, FK "the product sold"' });
    expect(node(ORDERS, 'PRODUCT').rows![0]).toEqual({ kind: 'label', text: 'Catalog product' });
    expect(node(ORDERS, 'ADDRESS').rows).toEqual([{ kind: 'label', text: 'ADDRESS' }]);
  });

  it('reads each cardinality as a crow\'s foot, and a non-identifying relationship as dashed', () => {
    expect(edge(ORDERS, 'CUSTOMER', 'ORDER')).toMatchObject({ label: 'places', colors: { markerStart: 'crow-one', markerEnd: 'crow-zero-many' } });
    expect(edge(ORDERS, 'ORDER', 'LINE_ITEM').colors).toEqual({ markerStart: 'crow-one', markerEnd: 'crow-one-many' });
    expect(edge(ORDERS, 'PRODUCT', 'LINE_ITEM')).toMatchObject({
      label: 'appears in', colors: { markerStart: 'crow-zero-one', markerEnd: 'crow-zero-many', dash: [4, 4] },
    });
    expect(edge(ORDERS, 'CUSTOMER', 'ADDRESS').colors).toEqual({ markerStart: 'crow-one-many', markerEnd: 'crow-one', dash: [4, 4] });
  });

  it('reads styles as colors, warning of nothing it keeps', () => {
    expect(node(ORDERS, 'ORDER').colors).toEqual({ fill: '#eeeeff', stroke: '#333366' });
    expect(readErDiagram(ORDERS).warnings).toEqual([]);
  });

  it('names the line it cannot read', () => {
    expect(() => parseErDiagram('erDiagram\nA {\nstring\n}')).toThrow(/^Mermaid, line 3: cannot read "string" as an attribute/);
    expect(() => parseErDiagram('erDiagram\nA ||--|| B')).toThrow(/^Mermaid, line 2: cannot read/);
    expect(() => parseErDiagram('erDiagram\nA {\nint id')).toThrow('Mermaid, line 2: entity A is never closed');
  });
});

describe('writing a Mermaid ER diagram', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(ORDERS);
    const text = writeErDiagram({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeErDiagram({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes entities with their attributes and relationships with their cardinalities', () => {
    const text = writeErDiagram({ pages: [page(ORDERS)] }).text;
    expect(text).toContain('  PRODUCT["Catalog product"] {\n    string sku PK\n');
    expect(text).toContain('  PRODUCT |o..o{ LINE_ITEM : "appears in"');
    expect(text).toContain('  ADDRESS\n');
  });

  it('writes an end with no crow\'s foot as exactly one, with a warning', () => {
    const { text, warnings } = writeErDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] },
    }] });
    expect(text).toContain('a ||--|| b : ""');
    expect(warnings).toContain('Mermaid ER relationships end in crow\'s feet; other ends were written as exactly one.');
  });

  it('writes an end named for an Object.prototype member as exactly one', () => {
    const { text } = writeErDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', colors: { markerEnd: 'constructor' } }] },
    }] });
    expect(text).toContain('a ||--|| b : ""');
  });

  it('writes an id holding a hyphen as itself, as it reads one', () => {
    const { text } = writeErDiagram(readErDiagram('erDiagram\n  LINE-ITEM ||--o{ ORDER : has').document);
    expect(text).toContain('  LINE-ITEM ||--o{ ORDER : "has"');
  });

  it('drops a connector to a container, with a warning', () => {
    const { text, warnings } = writeErDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'g' }], containers: [{ id: 'g', role: 'container', members: ['b'] }],
    } }] });
    expect(text).not.toContain('--');
    expect(warnings).toContain('Mermaid ER relationships join entities; connectors to containers were dropped.');
  });

  it('keeps an entity\'s name when its id is written cleaned', () => {
    const text = writeErDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'my entity', lines: ['my entity'] }], edges: [] } }] }).text;
    expect(page(text).data.nodes[0]!.rows?.[0]).toEqual({ kind: 'label', text: 'my entity' });
  });
});

/** `text` read, with node `from` renamed `to` in its nodes, their names, and edges. */
const renamed = (text: string, from: string, to: string) => {
  const p = page(text);
  const id = (s: string) => (s === from ? to : s);
  const data = { ...p.data, nodes: p.data.nodes.map((n) => ({ ...n, id: id(n.id), rows: n.rows?.map((r) => (r.kind === 'label' ? { ...r, text: id(r.text) } : r)) })), edges: p.data.edges.map((e) => ({ ...e, from: id(e.from), to: id(e.to) })) };
  return { pages: [{ ...p, data }] };
};

describe('an id Mermaid reads as accessibility text', () => {
  it('is renamed when written, so its line reads back as a statement of the diagram', () => {
    for (const acc of ['accTitle', 'accDescr']) {
      const back = page(writeErDiagram(renamed('erDiagram\n  x {\n    string name\n  }\n  x ||--o{ b : has', 'x', acc)).text);
      expect(back.data.nodes).toHaveLength(2);
      expect(back.data.edges).toHaveLength(1);
      expect(back.data.nodes.find((n) => n.id !== 'b')!.rows!.slice(1)).toEqual(node('erDiagram\n  x {\n    string name\n  }', 'x').rows!.slice(1));
    }
  });
});
