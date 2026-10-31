import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diagramThemeFrom } from '@weasel-js/diagram';
import { laidOutPage } from '../../pageLayout';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { parseBlockDiagram } from './parse';
import { readBlockDiagram } from './read';
import { writeBlockDiagram } from './write';

const SYSTEM = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'block', 'system.mmd'), 'utf8');
const page = (text: string) => onlyPage(readBlockDiagram(text).document);
const node = (text: string, id: string) => page(text).data.nodes.find((n) => n.id === id)!;

describe('reading a Mermaid block diagram', () => {
  it('reads a page of notation block, laid out by grid with the file\'s columns, spans, and spaces', () => {
    expect(page(SYSTEM)).toMatchObject({ name: 'Request path', notation: 'block' });
    expect(page(SYSTEM).layout).toEqual({
      name: 'grid',
      options: {
        nodeGap: 24, rankGap: 40,
        grid: { columns: 3, groupColumns: { services: 2 }, spans: { services: 3, wide: 3 }, skips: { gateway: 1, cache: 2 } },
      },
    });
  });

  it('reads blocks in the flowchart\'s shapes, bare ids as their own text', () => {
    expect(node(SYSTEM, 'client')).toMatchObject({ lines: ['Browser'], outline: 'roundRect' });
    expect(node(SYSTEM, 'gateway')).toMatchObject({ lines: ['Gateway'], outline: 'hexagon' });
    expect(node(SYSTEM, 'auth')).toMatchObject({ lines: ['Users'], outline: 'cylinder' });
    expect(node(SYSTEM, 'cache')).toMatchObject({ lines: ['Cache'], outline: 'ellipse' });
    expect(node(SYSTEM, 'worker')).toMatchObject({ lines: ['worker'], outline: 'rect' });
  });

  it('reads a nested block as a container holding its blocks in order, and links as edges', () => {
    const p = page(SYSTEM);
    expect(p.data.containers).toEqual([{ id: 'services', role: 'container', members: ['api', 'auth', 'queue', 'worker'] }]);
    expect(p.data.nodes.map((n) => n.id)).toEqual(['client', 'gateway', 'api', 'auth', 'queue', 'worker', 'cache', 'wide']);
    const edges = p.data.edges.map(({ from, to, label, colors }) => ({ from, to, label, colors }));
    expect(edges).toEqual([
      { from: 'client', to: 'gateway', label: undefined, colors: undefined },
      { from: 'gateway', to: 'api', label: 'routes', colors: undefined },
      { from: 'api', to: 'cache', label: undefined, colors: { dash: [4, 4] } },
      { from: 'worker', to: 'queue', label: undefined, colors: { markerEnd: null } },
    ]);
  });

  it('reads classes and styles as colors, and warns of what it drops', () => {
    expect(node(SYSTEM, 'gateway').colors).toEqual({ fill: '#ffeecc', stroke: '#aa6600' });
    expect(node(SYSTEM, 'cache').colors).toEqual({ fill: '#ddffdd' });
    expect(readBlockDiagram(SYSTEM).warnings).toEqual([
      'Mermaid shapes read as rectangles: asymmetric.', 'Mermaid statements a diagram does not hold were dropped: click.',
    ]);
  });

  it('names anonymous groups by their place, and reads arrows and spaces after the last block with a warning', () => {
    const { document, warnings } = readBlockDiagram('block-beta\n  block\n    a b\n  end\n  c<["go"]>(right) space');
    expect(onlyPage(document).data.containers![0]!.id).toBe('block-1');
    expect(warnings).toEqual([
      'Mermaid block arrows read as rectangles; their directions were dropped.',
      'Mermaid spaces after the last block in a row of blocks were dropped.',
    ]);
  });

  it('lays the page out in the file\'s grid', () => {
    const laid = laidOutPage(page(SYSTEM), { theme: diagramThemeFrom(undefined) });
    const at = (id: string) => laid.data.nodes.find((n) => n.id === id)!.at!;
    expect(Math.abs(at('client').y - at('gateway').y)).toBeLessThan(10);
    expect(at('gateway').x).toBeGreaterThan(at('client').x + 200);
    expect(Math.abs(at('auth').y - at('api').y)).toBeLessThan(20);
    expect(at('queue').y).toBeGreaterThan(at('api').y);
    expect(at('cache').y).toBeGreaterThan(at('worker').y);
    expect(at('wide').y).toBeGreaterThan(at('cache').y);
  });

  it('names the line it cannot read', () => {
    expect(() => parseBlockDiagram('block-beta\n  block:g\n    a')).toThrow('Mermaid, line 2: a block opened here is never closed');
    expect(() => parseBlockDiagram('block-beta\n  a["x"\n')).toThrow('Mermaid, line 2: a shape opened with "[" is never closed');
    expect(() => parseBlockDiagram('block-beta\n  a --> space')).toThrow(/^Mermaid, line 2: cannot read "a --> space"/);
    expect(() => parseBlockDiagram('block-beta\n  end')).toThrow('Mermaid, line 2: "end" closes no block');
  });
});

describe('writing a Mermaid block diagram', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(SYSTEM);
    const text = writeBlockDiagram({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeBlockDiagram({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes columns, spans, spaces, groups, and links', () => {
    const text = writeBlockDiagram({ pages: [page(SYSTEM)] }).text;
    expect(text).toContain('block-beta\n  columns 3\n  client("Browser")\n  space\n  gateway{{"Gateway"}}\n  block:services:3\n    columns 2\n');
    expect(text).toContain('  space:2\n  cache(("Cache"))\n  wide["Logs"]:3\n');
    expect(text).toContain('  gateway -- "routes" --> api\n  api -.-> cache\n  worker --- queue\n');
    expect(text).toContain('  style gateway fill:#ffeecc,stroke:#aa6600\n');
  });

  it('writes a page laid out some other way as one row', () => {
    const { text } = writeBlockDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100,
      data: { nodes: [{ id: 'a', lines: ['A'], outline: 'stadium' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', label: 'x' }] },
    }] });
    expect(text).toBe('block-beta\n  a(["A"])\n  b[" "]\n  a -- "x" --> b\n');
  });
});
