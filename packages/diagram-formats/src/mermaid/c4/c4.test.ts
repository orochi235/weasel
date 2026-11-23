import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataEdgeStyle, diagramThemeFrom, type DataNode } from '@weasel-js/diagram';
import { laidOutPage } from '../../pageLayout';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { parseC4 } from './parse';
import { readC4 } from './read';
import { writeC4 } from './write';

const BANKING = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'c4', 'banking.mmd'), 'utf8');
const page = (text: string) => onlyPage(readC4(text).document);
const node = (id: string) => page(BANKING).data.nodes.find((n) => n.id === id) as DataNode;
const edge = (from: string, to: string) => page(BANKING).data.edges.find((e) => e.from === from && e.to === to)!;
const texts = (n: DataNode) => n.rows!.map((r) => (r.kind === 'label' ? r.text : r.kind));

describe('reading a Mermaid C4 diagram', () => {
  it('reads a page whose notation names its header, named by its title', () => {
    expect(page(BANKING)).toMatchObject({ name: 'Internet banking', notation: 'c4-container' });
    expect(page('C4Deployment\n  Deployment_Node(n, "Node")').notation).toBe('c4-deployment');
  });

  it('reads each element as its kind\'s outline and role, its rows naming the kind, its name, technology, and description', () => {
    expect(node('customer')).toMatchObject({ outline: 'person', style: 'accent', width: 200 });
    expect(texts(node('customer'))).toEqual(['<<person>>', 'Customer', 'A customer of the bank, with', 'personal bank accounts.']);
    expect(node('customer').rows![1]).toEqual({ kind: 'label', text: 'Customer', style: { bold: true } });
    expect(node('mail')).toMatchObject({ outline: 'roundRect', style: 'muted' });
    expect(texts(node('spa')).slice(0, 3)).toEqual(['<<container>>', 'Single-Page App', '[JavaScript, Angular]']);
    expect(node('db')).toMatchObject({ outline: 'cylinder', style: 'accent' });
    expect(texts(node('events'))).toEqual(['<<external_container_queue>>', 'Events', '[Kafka]']);
    expect(node('events')).toMatchObject({ outline: 'queue', style: 'muted' });
  });

  it('reads boundaries as containers labeled with their type', () => {
    expect(page(BANKING).data.containers).toEqual([
      { id: 'bank', role: 'container', label: 'Bank [enterprise]', members: ['ibs', 'ops'] },
      { id: 'ibs', role: 'container', label: 'Internet Banking [system]', members: ['spa', 'db', 'events'] },
      { id: 'ops', role: 'container', label: 'Operations [team]', members: ['audit'] },
    ]);
  });

  it('reads relationships as edges labeled with their technology, their direction as ports, and styles as colors', () => {
    expect(edge('customer', 'spa')).toMatchObject({ label: 'Uses [HTTPS]', colors: { label: 'blue', stroke: 'blue' } });
    expect(edge('spa', 'db')).toMatchObject({ label: 'Reads from and writes to [JDBC]', fromPort: 's', toPort: 'n' });
    expect(edge('spa', 'events').colors).toEqual({ markerStart: 'arrow' });
    expect(edge('audit', 'db').colors).toEqual({ markerStart: 'arrow', markerEnd: null });
    expect(node('customer').colors).toEqual({ fill: 'gray', stroke: 'black', text: 'white' });
  });

  it('warns of what it drops', () => {
    expect(readC4(BANKING).warnings).toEqual([
      'Mermaid C4 sprites, tags, links, and descriptions a diagram does not hold were dropped.',
      'Mermaid C4 arguments a diagram does not hold were dropped: $tags, $offsetX.',
      'Mermaid C4 statements a diagram does not hold were dropped: UpdateLayoutConfig.',
    ]);
  });

  it('warns that a front matter title or an accessible title was dropped for a title statement', () => {
    const front = readC4('---\ntitle: A\n---\nC4Context\n  title B');
    expect(onlyPage(front.document).name).toBe('B');
    expect(front.warnings).toEqual(['The front matter title was dropped; the title statement names the chart.']);
    expect(readC4('C4Context\n  accTitle: A\n  title B').warnings).toEqual(['Mermaid accessible titles were dropped; the page is named by the title.']);
    expect(readC4('---\ntitle: B\n---\nC4Context\n  title B').warnings).toEqual([]);
  });

  it('lays the page out', () => {
    const laid = laidOutPage(page(BANKING), { theme: diagramThemeFrom(undefined) });
    expect(laid.data.nodes.every((n) => n.at !== undefined)).toBe(true);
  });

  it('reads an argument named $__proto__ as data', () => {
    const stmt = parseC4('C4Context\n  Person(a, "A", $__proto__="x")').stmts[0] as { args: { named: Record<string, string> } };
    expect(Object.getPrototypeOf(stmt.args.named)).toBe(Object.prototype);
    expect(Object.hasOwn(stmt.args.named, '__proto__') && stmt.args.named['__proto__']).toBe('x');
  });

  it('names the line it cannot read', () => {
    expect(() => parseC4('C4Context\n  Person(a, "A"')).toThrow(/^Mermaid, line 2: cannot read/);
    expect(() => parseC4('C4Context\n  Boundary(b, "B") {\n  Person(a, "A")')).toThrow('Mermaid, line 2: a boundary opened here is never closed');
    expect(() => parseC4('C4Diagram\n')).toThrow('Mermaid, line 1: expected a C4 header, found "C4Diagram"');
  });
});

describe('writing a Mermaid C4 diagram', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(BANKING);
    const text = writeC4({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeC4({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes quotes and character references in text as Mermaid references, so they read back as written', () => {
    const first = page('C4Context\n  Person(a, "say #quot;hi#quot;", "#35;lt; is #lt;")\n  System(b, "B")\n  Rel(a, b, "uses #quot;x#quot;")');
    const text = writeC4({ pages: [first] }).text;
    expect(text).toContain('Person(a, "say #quot;hi#quot;", "#35;lt; is #lt;")');
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
  });

  it('writes each element by its kind row, boundaries by their type, and relationships by their ends and ports', () => {
    const text = writeC4({ pages: [page(BANKING)] }).text;
    expect(text).toContain('C4Container\n  title Internet banking\n  Person(customer, "Customer", "A customer of the bank, with personal bank accounts.")\n');
    expect(text).toContain('  Enterprise_Boundary(bank, "Bank") {\n    System_Boundary(ibs, "Internet Banking") {\n');
    expect(text).toContain('      ContainerQueue_Ext(events, "Events", "Kafka")\n');
    expect(text).toContain('    Boundary(ops, "Operations", "team") {\n      Component(audit, "Audit")\n    }\n');
    expect(text).toContain('  Rel_D(spa, db, "Reads from and writes to", "JDBC")\n  BiRel(spa, events, "Streams")\n  Rel_Back(audit, db, "Reads")\n');
    expect(text).toContain('  UpdateElementStyle(customer, $bgColor="gray", $fontColor="white", $borderColor="black")\n');
    expect(text).toContain('  UpdateRelStyle(customer, spa, $textColor="blue", $lineColor="blue")\n');
  });

  it('keeps a description shaped like a technology as the description', () => {
    const read = readC4('C4Container\n  Container(a, "Api", "", "[beta]")\n  Person(u, "User", "[vip]")');
    const { text, warnings } = writeC4(read.document);
    expect(text).toContain('  Container(a, "Api", "", "[beta]")\n  Person(u, "User", "[vip]")\n');
    expect(warnings).toEqual([]);
  });

  it('writes a relationship\'s colors from its theme role', () => {
    const { text } = writeC4({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', style: 'accent' }],
    } }] });
    const stroke = dataEdgeStyle({ style: 'accent' }, diagramThemeFrom(undefined)).stroke;
    expect(text).toContain(`  UpdateRelStyle(a, b, $textColor="${stroke}", $lineColor="${stroke}")`);
  });

  it('writes a plain page as systems, people by their outline, and containers as boundaries', () => {
    const { text } = writeC4({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100, notation: 'c4-deployment',
      data: {
        nodes: [{ id: 'a', lines: ['A', 'does things'] }, { id: 'u', lines: ['User'], outline: 'actor', style: 'muted' }],
        edges: [{ from: 'u', to: 'a' }], containers: [{ id: 'n', role: 'container', label: 'Server', members: ['a'] }],
      },
    }] });
    expect(text).toBe('C4Deployment\n  Person_Ext(u, "User")\n  Deployment_Node(n, "Server") {\n    System(a, "A", "does things")\n  }\n  Rel(u, a, "")\n');
  });

  it('writes a person whose kind row names a store or a queue as a person, so it and its relationships read back', () => {
    const { text, warnings } = writeC4({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'a', outline: 'person', lines: ['<<person_db>>', 'Alice'] }, { id: 'b', lines: ['Bank'] }],
      edges: [{ from: 'a', to: 'b', label: 'uses' }],
    } }] });
    expect(text).toMatch(/^\s*Person\(a, "Alice"\)$/m);
    expect(warnings).toContain('Mermaid C4 has no store or queue of people; they were written as people.');
    const back = readC4(text);
    expect(onlyPage(back.document).data.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(onlyPage(back.document).data.edges).toHaveLength(1);
  });

  it('warns that an end it has no head for was written as an arrow', () => {
    const { warnings } = writeC4({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', colors: { markerEnd: 'diamond' } }] } }] });
    expect(warnings).toContain('Mermaid C4 links end in arrows; other ends were written as arrows.');
  });

  it('writes no title line for a blank page name, so the file reads back', () => {
    for (const name of ['', ' ']) {
      const { text } = writeC4({ pages: [{ kind: 'graph', id: 'p', name, width: 100, height: 100, data: { nodes: [{ id: 'a' }], edges: [] } }] });
      expect(text).not.toContain('title');
      expect(() => readC4(text)).not.toThrow();
    }
  });
});

describe('readC4 on a repeated alias', () => {
  it('throws, naming the line, on an alias an element or a boundary already names', () => {
    expect(() => readC4('C4Context\n  System(a, "A")\n  System_Boundary(b, "B") {\n    System(a, "A2")\n  }')).toThrow(/line 4.*"a" already names/);
    expect(() => readC4('C4Context\n  Boundary(b, "B") {\n  }\n  Boundary(b, "C") {\n  }')).toThrow(/line 4.*"b" already names/);
  });
});

describe('C4 style macros naming nothing', () => {
  it('drop, with a warning, a style naming no element or relationship declared above it', () => {
    const { document, warnings } = readC4('C4Context\n  UpdateElementStyle(typo, $bgColor="red")\n  UpdateRelStyle(a, b, $lineColor="red")\n  System(a, "A")');
    expect(onlyPage(document).data.nodes).toHaveLength(1);
    expect(warnings).toEqual([
      'Mermaid C4 styles naming no element or boundary declared above them were dropped: typo.',
      'Mermaid C4 styles naming no relationship declared above them were dropped: a -> b.',
    ]);
  });

  it('styles only the first relationship between two elements, as Mermaid does', () => {
    const { document } = readC4('C4Context\n  System(a, "A")\n  System(b, "B")\n  Rel(a, b, "x")\n  Rel(a, b, "y")\n  UpdateRelStyle(a, b, $lineColor="red")');
    expect(onlyPage(document).data.edges.map((e) => e.colors)).toEqual([{ stroke: 'red' }, undefined]);
  });

  it('writes no style for a later relationship between the same two elements, with a warning', () => {
    const { document } = readC4('C4Context\n  System(a, "A")\n  System(b, "B")\n  Rel(a, b, "x")\n  Rel(a, b, "y")');
    const page = onlyPage(document);
    const edges = [page.data.edges[0]!, { ...page.data.edges[1]!, colors: { stroke: 'red' } }];
    const out = writeC4({ pages: [{ ...page, data: { ...page.data, edges } }] });
    expect(out.text).not.toContain('UpdateRelStyle');
    expect(out.warnings).toContain('Mermaid C4 styles only the first relationship between two elements; colors of the others were dropped.');
  });
});

describe('C4 deployment nodes', () => {
  it('write back as deployment nodes whatever their type, so a "container" node stays one', () => {
    const { document } = readC4('C4Deployment\n  Deployment_Node(d, "Web", "container") {\n    Container(c, "App")\n  }');
    expect(writeC4(document).text).toContain('Deployment_Node(d, "Web", "container") {');
  });
});

describe('writing connector parts Mermaid C4 diagrams hold no place for', () => {
  it('warns that they were dropped', () => {
    const p = page('C4Context\n  System(a, "A")\n  System(b, "B")\n  Rel(a, b, "x")');
    const edges = p.data.edges.map((e) => ({ ...e, endLabels: { from: '1' }, colors: { ...e.colors, stroke: '#f00', label: '#00f', width: 3 } }));
    const { warnings } = writeC4({ pages: [{ ...p, data: { ...p.data, edges } }] });
    expect(warnings).toEqual(expect.arrayContaining(['Mermaid C4 diagrams have no labels at a connector\'s ends; they were dropped.', 'Mermaid C4 diagram connectors hold no widths; they were dropped.']));
  });
});
