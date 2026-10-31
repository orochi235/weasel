import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diagramThemeFrom, type DataNode } from '@weasel-js/diagram';
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

  it('lays the page out', () => {
    const laid = laidOutPage(page(BANKING), { theme: diagramThemeFrom(undefined) });
    expect(laid.data.nodes.every((n) => n.at !== undefined)).toBe(true);
  });

  it('names the line it cannot read', () => {
    expect(() => parseC4('C4Context\n  Person(a, "A"')).toThrow(/^Mermaid, line 2: cannot read/);
    expect(() => parseC4('C4Context\n  Boundary(b, "B") {\n  Person(a, "A")')).toThrow('Mermaid, line 2: a boundary opened here is never closed');
    expect(() => readC4('C4Context\n  UpdateElementStyle(x, $bgColor="red")')).toThrow('Mermaid, line 2: no element or boundary is named "x"');
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
});
