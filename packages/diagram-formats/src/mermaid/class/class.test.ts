import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { parseClassDiagram } from './parse';
import { readClassDiagram } from './read';
import { writeClassDiagram } from './write';

const SHOP = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'class', 'shop.mmd'), 'utf8');
const page = (text: string) => onlyPage(readClassDiagram(text).document);
const node = (text: string, id: string) => page(text).data.nodes.find((n) => n.id === id) as DataNode;
const edge = (text: string, from: string, to: string) => page(text).data.edges.find((e) => e.from === from && e.to === to)!;

describe('reading a Mermaid class diagram', () => {
  it('reads a page of notation class, named and run as the file says', () => {
    expect(page(SHOP)).toMatchObject({ name: 'Shop model', direction: 'right', notation: 'class' });
  });

  it('reads a class as its annotations and name, a divider, attributes, a divider, and methods', () => {
    expect(node(SHOP, 'Order').rows).toEqual([
      { kind: 'label', text: '<<entity>>' }, { kind: 'label', text: 'Order' }, { kind: 'divider' },
      { kind: 'label', text: '+int id' }, { kind: 'label', text: '-Date placed' }, { kind: 'divider' },
      { kind: 'label', text: '+total() Money' },
    ]);
    expect(node(SHOP, 'Repository').rows!.slice(0, 2)).toEqual([{ kind: 'label', text: '<<interface>>' }, { kind: 'label', text: 'Repository<T>' }]);
    expect(node(SHOP, 'Money').rows).toEqual([
      { kind: 'label', text: '<<value>>' }, { kind: 'label', text: 'Money value' }, { kind: 'divider' },
      { kind: 'label', text: '+int cents' }, { kind: 'divider' }, { kind: 'label', text: '+add(other Money) Money' },
    ]);
    expect(node(SHOP, 'LineItem').rows).toEqual([{ kind: 'label', text: 'LineItem' }, { kind: 'divider' }, { kind: 'divider' }]);
  });

  it('reads each relation\'s ends and line, its label, and its cardinalities as end labels', () => {
    expect(edge(SHOP, 'Customer', 'Order')).toMatchObject({ label: 'places', endLabels: { from: '1', to: '0..*' } });
    expect(edge(SHOP, 'Customer', 'Order').colors).toBeUndefined();
    expect(edge(SHOP, 'Order', 'LineItem').colors).toEqual({ markerStart: 'diamond', markerEnd: null });
    expect(edge(SHOP, 'Order', 'Address').colors).toEqual({ markerStart: 'diamond-hollow', markerEnd: null });
    expect(edge(SHOP, 'Repository', 'OrderRepository').colors).toEqual({ dash: [4, 4], markerStart: 'triangle-hollow', markerEnd: null });
    expect(edge(SHOP, 'Entity', 'Order').colors).toEqual({ markerStart: 'triangle-hollow', markerEnd: null });
    expect(edge(SHOP, 'Invoice', 'Order').colors).toEqual({ dash: [4, 4], markerEnd: 'arrow-open' });
    expect(edge(SHOP, 'Payment', 'Invoice').colors).toEqual({ markerEnd: null });
    expect(edge(SHOP, 'Order', 'Money').colors).toEqual({ dash: [4, 4], markerEnd: null });
    expect(edge('classDiagram\nA --|> B', 'A', 'B').colors).toEqual({ markerEnd: 'triangle-hollow' });
  });

  it('reads namespaces as containers, notes as note shapes, and styles as colors', () => {
    const p = page(SHOP);
    expect(p.data.containers).toEqual([{ id: 'billing', role: 'container', label: 'billing', members: ['Invoice', 'Payment'] }]);
    expect(p.data.nodes.filter((n) => n.outline === 'note').map((n) => n.lines)).toEqual([['Prices are in cents'], ['Registered', 'shoppers only']]);
    expect(edge(SHOP, 'note-2', 'Customer').colors).toEqual({ dash: [4, 4], markerEnd: null });
    expect(node(SHOP, 'Customer').colors).toEqual({ fill: '#ffeecc', stroke: '#aa6600' });
    expect(node(SHOP, 'Payment').colors).toEqual({ fill: '#ddffdd' });
  });

  it('warns of what it drops', () => {
    expect(readClassDiagram(SHOP).warnings).toEqual([
      'Mermaid statements a diagram does not hold were dropped: click.', 'Mermaid accessible titles were dropped; the page is named by the title.',
    ]);
    expect(readClassDiagram('---\ntitle: T\n---\nclassDiagram\naccTitle: A\naccDescr: D\nA').warnings).toEqual([
      'Mermaid accessible descriptions were dropped.', 'Mermaid accessible titles were dropped; the page is named by the title.',
    ]);
  });

  it('names the line it cannot read', () => {
    expect(() => parseClassDiagram('classDiagram\nclass A {\n+x')).toThrow('Mermaid, line 2: class A is never closed');
    expect(() => parseClassDiagram('classDiagram\nA ==> B')).toThrow(/^Mermaid, line 2: cannot read "A ==> B"/);
    expect(() => parseClassDiagram('classDiagram\nnamespace N {\nclass A')).toThrow('Mermaid, line 2: a block opened here is never closed');
  });
});

describe('writing a Mermaid class diagram', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(SHOP);
    const text = writeClassDiagram({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeClassDiagram({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes members in a block, generics as tildes, and relations with their cardinalities', () => {
    const text = writeClassDiagram({ pages: [page(SHOP)] }).text;
    expect(text).toContain('  class Repository~T~ {\n    <<interface>>\n    +find(id int) T\n');
    expect(text).toContain('  Customer "1" --> "0..*" Order : places');
    expect(text).toContain('  Repository <|.. OrderRepository');
    expect(text).toContain('  note for Customer "Registered\\nshoppers only"');
  });

  it('writes a plain box\'s lines as a class, warning of ends it has no head for', () => {
    const { text, warnings } = writeClassDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100,
      data: { nodes: [{ id: 'a', lines: ['A', 'x', 'go()'] }, { id: 'b' }], edges: [{ from: 'a', to: 'b', colors: { markerEnd: 'circle' } }] },
    }] });
    expect(text).toContain('class a["A"] {\n    x\n    go()\n  }');
    expect(text).toContain('a --> b');
    expect(warnings).toContain('Mermaid class diagrams have only UML ends; others were written as arrows.');
  });
});
