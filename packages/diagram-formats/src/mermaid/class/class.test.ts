import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { documentSpecs } from '../../toScene';
import { parseClassDiagram } from './parse';
import { readClassDiagram } from './read';
import { classParts, writeClassDiagram } from './write';

const SHOP = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'class', 'shop.mmd'), 'utf8');
const page = (text: string) => onlyPage(readClassDiagram(text).document);
const node = (text: string, id: string) => page(text).data.nodes.find((n) => n.id === id) as DataNode;
const edge = (text: string, from: string, to: string) => page(text).data.edges.find((e) => e.from === from && e.to === to)!;

describe('reading a Mermaid class diagram', () => {
  it('warns that front matter other than the title was dropped, as it does for a directive', () => {
    const { warnings } = readClassDiagram('---\ntitle: T\nconfig:\n  theme: dark\n---\nclassDiagram\n  class A');
    expect(warnings).toEqual(['Mermaid front matter other than the title was dropped.']);
    expect(readClassDiagram('---\ntitle: T\n---\nclassDiagram\n  class A').warnings).toEqual([]);
  });

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
    expect(readClassDiagram('---\ntitle: T\n---\nclassDiagram\naccTitle: A\naccDescr: D\nclass A').warnings).toEqual([
      'Mermaid accessible descriptions were dropped.', 'Mermaid accessible titles were dropped; the page is named by the title.',
    ]);
  });

  it('names the line it cannot read', () => {
    expect(() => parseClassDiagram('classDiagram\nclass A {\n+x')).toThrow('Mermaid, line 2: class A is never closed');
    expect(() => parseClassDiagram('classDiagram\nA ==> B')).toThrow(/^Mermaid, line 2: cannot read "A ==> B"/);
    expect(() => parseClassDiagram('classDiagram\nnamespace N {\nclass A')).toThrow('Mermaid, line 2: a block opened here is never closed');
  });

  it('gives a note an id no class holds', () => {
    const read = readClassDiagram('classDiagram\nclass note-1\nnote "hi"');
    expect(onlyPage(read.document).data.nodes.map((n) => n.id)).toEqual(['note-1', 'note-2']);
    expect(() => documentSpecs(read.document)).not.toThrow();
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

  it('reads and writes nested generics, in a class and a relation', () => {
    const read = readClassDiagram('classDiagram\n  class Foo~List~int~~\n  Foo~List~int~~ --> Bar');
    const p = onlyPage(read.document);
    expect(classParts(p.data.nodes.find((n) => n.id === 'Foo')!).name).toBe('Foo<List<int>>');
    expect(p.data.edges).toMatchObject([{ from: 'Foo', to: 'Bar' }]);
    expect(writeClassDiagram(read.document).text).toContain('  class Foo~List~int~~\n');
  });

  it('writes ids holding a hyphen, and namespaces holding a dot, as themselves, as it reads them', () => {
    const { text, warnings } = writeClassDiagram(readClassDiagram('classDiagram\n  namespace com.example {\n    class my-class\n  }').document);
    expect(text).toContain('  namespace com.example {\n    class my-class\n');
    expect(warnings).toEqual([]);
  });

  it('warns that an open arrow on a solid line, or a filled one on a dashed line, was written as its line\'s', () => {
    const write = (edge: object) => writeClassDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', ...edge }],
    } }] }).warnings;
    const warning = 'Mermaid class relations draw an open arrow on a dashed line and a filled one on a solid line; other arrows were written as their line\'s.';
    expect(write({ colors: { markerEnd: 'arrow-open' } })).toContain(warning);
    expect(write({ colors: { markerEnd: 'arrow', dash: [4, 4] } })).toContain(warning);
    expect(write({ colors: { markerEnd: 'arrow-open', dash: [4, 4] } })).not.toContain(warning);
    expect(write({})).not.toContain(warning);
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

  it('writes an end named for an Object.prototype member as an arrow', () => {
    const { text } = writeClassDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', colors: { markerEnd: 'toString' } }] },
    }] });
    expect(text).toContain('a --> b');
  });

  it('keeps a class\'s name when its id is written cleaned', () => {
    const text = writeClassDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'my class', lines: ['my class'] }], edges: [] } }] }).text;
    expect(page(text).data.nodes[0]!.rows).toContainEqual({ kind: 'label', text: 'my class' });
  });

  it('writes a note whose text is in its rows', () => {
    const text = writeClassDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'n', outline: 'note', rows: [{ kind: 'label', text: 'remember' }] }], edges: [] } }] }).text;
    expect(text).toContain('  note "remember"');
  });

  it('keeps a backslash and the n after it in a note line', () => {
    const text = writeClassDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'n', outline: 'note', lines: ['C:\\new', 'two'] }], edges: [] } }] }).text;
    expect(page(text).data.nodes[0]!.lines).toEqual(['C:\\new', 'two']);
  });

  it('drops a connector to a namespace, with a warning, rather than name a class for it', () => {
    const { text, warnings } = writeClassDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'n', outline: 'note', lines: ['hi'] }], edges: [{ from: 'b', to: 'g' }, { from: 'n', to: 'g' }],
      containers: [{ id: 'g', role: 'container', members: ['a'] }],
    } }] });
    expect(page(text).data.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'note-1']);
    expect(page(text).data.edges).toEqual([]);
    expect(warnings).toContain('Mermaid class relations join classes; connectors to namespaces were dropped.');
  });
});

/** A one-class page whose box has `rows`. */
const boxed = (rows: DataNode['rows']) => {
  const p = page('classDiagram\n  class Foo');
  return { pages: [{ ...p, data: { ...p.data, nodes: [{ ...p.data.nodes[0]!, rows }] } }] };
};

describe('writing a class box Mermaid would read back otherwise', () => {
  it('quotes a generic name whose tildes would not read back as its angle brackets', () => {
    for (const name of ['Foo<List<?>>', 'Foo<Map<Ä>>', 'Foo<List<[int]>>', 'Foo<List<K>V>']) {
      const back = readClassDiagram(writeClassDiagram(boxed([{ kind: 'label', text: name }])).text);
      expect(classParts(onlyPage(back.document).data.nodes[0]!).name).toBe(name);
    }
  });

  it('drops a member row Mermaid reads as an annotation, with a warning', () => {
    const { text, warnings } = writeClassDiagram(boxed([{ kind: 'label', text: 'Foo' }, { kind: 'divider' }, { kind: 'label', text: '<<x>>' }, { kind: 'label', text: 'y' }]));
    expect(classParts(onlyPage(readClassDiagram(text).document).data.nodes[0]!).annotations).toEqual([]);
    expect(warnings).toContain('Mermaid class members are lines of text; blank ones, and ones it reads as comments, a closing brace, or an annotation, were dropped.');
  });

});
