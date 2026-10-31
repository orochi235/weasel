import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diagramThemeFrom } from '@weasel-js/diagram';
import { laidOutPage } from '../../pageLayout';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { parseArchitecture } from './parse';
import { readArchitecture } from './read';
import { writeArchitecture } from './write';

const CLOUD = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'architecture', 'cloud.mmd'), 'utf8');
const page = (text: string) => onlyPage(readArchitecture(text).document);
const node = (id: string) => page(CLOUD).data.nodes.find((n) => n.id === id)!;
const edge = (from: string, to: string) => page(CLOUD).data.edges.find((e) => e.from === from && e.to === to)!;

describe('reading a Mermaid architecture diagram', () => {
  it('reads a page of notation architecture, named as the file says', () => {
    expect(page(CLOUD)).toMatchObject({ name: 'Hosting', notation: 'architecture', direction: 'right' });
  });

  it('reads services in their built-in icon\'s outline, others as rounded boxes, and junctions as dots', () => {
    expect(node('gateway')).toEqual({ id: 'gateway', lines: ['Gateway'], outline: 'globe' });
    expect(node('server').outline).toBe('server');
    expect(node('db').outline).toBe('cylinder');
    expect(node('disk1').outline).toBe('disk');
    expect(node('fn').outline).toBe('roundRect');
    expect(node('web')).toEqual({ id: 'web', lines: ['Web App'], outline: 'roundRect' });
    expect(node('mid')).toMatchObject({ lines: [], outline: 'start', width: 12, height: 12 });
  });

  it('reads groups as containers, nested by `in`', () => {
    expect(page(CLOUD).data.containers).toEqual([
      { id: 'api', role: 'container', label: 'API', members: ['private', 'server', 'fn', 'mid'] },
      { id: 'private', role: 'container', label: 'Private', members: ['db', 'disk1'] },
    ]);
  });

  it('reads each side as a compass port, arrows as heads, and `{group}` as an end on the group', () => {
    expect(edge('gateway', 'server')).toMatchObject({ fromPort: 'e', toPort: 'w' });
    expect(edge('gateway', 'server').colors).toBeUndefined();
    expect(edge('server', 'mid')).toMatchObject({ fromPort: 's', toPort: 'n', colors: { markerEnd: null } });
    expect(edge('db', 'disk1')).toMatchObject({ fromPort: 'w', toPort: 'e', colors: { markerStart: 'arrow', markerEnd: null } });
    const group = edge('api', 'web');
    expect(group).toMatchObject({ toPort: 'w', colors: { markerStart: 'arrow' } });
    expect(group.fromPort).toBeUndefined();
  });

  it('warns of icons it has no outline for and of group icons', () => {
    expect(readArchitecture(CLOUD).warnings).toEqual([
      'Mermaid group icons were dropped: cloud.', 'Mermaid icons not built in were drawn as rounded boxes: logos:aws-lambda.',
    ]);
  });

  it('lays the page out, the edge to a group meeting its box', () => {
    const laid = laidOutPage(page(CLOUD), { theme: diagramThemeFrom(undefined) });
    expect(laid.data.nodes.every((n) => n.at !== undefined)).toBe(true);
  });

  it('names the line it cannot read', () => {
    expect(() => parseArchitecture('architecture-beta\n  service a[A]\n  a -> b')).toThrow(/^Mermaid, line 3: cannot read "a -> b"/);
    expect(() => readArchitecture('architecture-beta\n  service a[A] in g')).toThrow('Mermaid, line 2: no group is named "g"');
    expect(() => readArchitecture('architecture-beta\n  service a[A]\n  a:R -- L:b')).toThrow('Mermaid, line 3: no service or junction is named "b"');
  });
});

describe('writing a Mermaid architecture diagram', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(CLOUD);
    const text = writeArchitecture({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeArchitecture({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes groups first, then services and junctions with their groups, then edges with their sides', () => {
    const text = writeArchitecture({ pages: [page(CLOUD)] }).text;
    expect(text).toContain('architecture-beta\n  group api[API]\n  group private[Private] in api\n  service gateway(internet)[Gateway]\n');
    expect(text).toContain('  service fn[Function] in api\n  service web[Web App]\n  junction mid in api\n');
    expect(text).toContain('  gateway:R --> L:server\n  server:B -- T:mid\n');
    expect(text).toContain('  db:L <-- R:disk1\n  server{group}:R <--> L:web\n');
  });

  it('writes a page from elsewhere with default sides, warning of what it drops', () => {
    const { text, warnings } = writeArchitecture({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100,
      data: { nodes: [{ id: 'a', lines: ['A'], outline: 'hexagon' }, { id: 'b', colors: { fill: '#fff' } }], edges: [{ from: 'a', to: 'b', label: 'x' }] },
    }] });
    expect(text).toBe('architecture-beta\n  service a[A]\n  service b\n  a:R --> L:b\n');
    expect(warnings).toEqual([
      'Mermaid architecture services wear only its built-in icons; other outlines were dropped.',
      'Mermaid architecture edges have no labels; they were dropped.',
      'Mermaid architecture diagrams have no styles; colors were dropped.',
    ]);
  });
});
