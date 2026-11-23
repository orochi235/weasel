import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diagramThemeFrom } from '@weasel-js/diagram';
import { laidOutPage } from '../../pageLayout';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { documentSpecs } from '../../toScene';
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
        grid: { columns: 3, clusterColumns: { services: 2 }, spans: { services: 3, wide: 3 }, skips: { gateway: 1, cache: 2 } },
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

  it('gives `classDef default` to blocks but not to groups, as a flowchart gives it to nodes but not subgraphs', () => {
    const read = page('block-beta\n  block:g\n    a\n  end\n  classDef default fill:#ff0000');
    expect(read.data.nodes[0]!.colors).toEqual({ fill: '#ff0000' });
    expect(read.data.containers![0]!.colors).toBeUndefined();
  });

  it('refuses a group id given twice, or given to a block', () => {
    expect(() => readBlockDiagram('block-beta\n  block:g\n    a\n  end\n  block:g\n    b\n  end')).toThrow('Mermaid, line 5: "g" already names a group');
    expect(() => readBlockDiagram('block-beta\n  g\n  block:g\n    a\n  end')).toThrow('Mermaid, line 2: "g" already names a group');
    expect(() => readBlockDiagram('block-beta\n  block:g\n    a\n  end\n  g')).toThrow('Mermaid, line 5: "g" already names a group');
  });

  it('gives an anonymous group an id no block holds', () => {
    const read = readBlockDiagram('block-beta\n  block-1\n  block\n    a\n  end');
    expect(onlyPage(read.document).data.containers!.map((c) => c.id)).toEqual(['block-2']);
    expect(() => documentSpecs(read.document)).not.toThrow();
  });

  it('keeps a block named __proto__ as its own grid entry', () => {
    const grid = page('block-beta\n  columns 3\n  space __proto__:2').layout?.options?.grid;
    expect(Object.getPrototypeOf(grid!.spans)).toBe(Object.prototype);
    expect(Object.hasOwn(grid!.spans!, '__proto__') && grid!.spans!['__proto__']).toBe(2);
    expect(Object.hasOwn(grid!.skips!, '__proto__') && grid!.skips!['__proto__']).toBe(1);
  });

  it('places a space before a line of links ahead of that line\'s first new block', () => {
    const { document, warnings } = readBlockDiagram('block-beta\n  columns 3\n  space\n  a --> b\n  c');
    expect(onlyPage(document).layout?.options?.grid?.skips).toEqual({ a: 1 });
    expect(warnings).toEqual([]);
  });

  it('warns that a lean-left block reads as its mirror image', () => {
    expect(readBlockDiagram('block-beta\n  a[\\"x"\\]').warnings).toContain('Mermaid shapes read as their mirror images: lean-left.');
  });

  it('joins a link to a group declared after it', () => {
    const read = readBlockDiagram('block-beta\n  x --> G\n  block:G\n    a\n  end');
    expect(onlyPage(read.document).data.nodes.map((n) => n.id)).toEqual(['x', 'a']);
    expect(onlyPage(read.document).data.edges).toMatchObject([{ from: 'x', to: 'G' }]);
    expect(() => documentSpecs(read.document)).not.toThrow();
  });
});

describe('writing a Mermaid block diagram', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(SYSTEM);
    const text = writeBlockDiagram({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeBlockDiagram({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes grid counts as whole numbers its reader reads', () => {
    const base = page('block-beta\n  block:g\n    a\n  end\n  b');
    const grid = { columns: 2.5, clusterColumns: { g: 1.6 }, spans: { b: 2.5 }, skips: { b: 1.4, g: 0.2 } };
    const { text, warnings } = writeBlockDiagram({ pages: [{ ...base, layout: { name: 'grid', options: { grid } } }] });
    expect(text).toContain('block-beta\n  columns 3\n  block:g\n    columns 2\n    a\n  end\n  space\n  b:3\n');
    expect(page(text).layout).toMatchObject({ options: { grid: { columns: 3, clusterColumns: { g: 2 }, spans: { b: 3 }, skips: { b: 1 } } } });
    expect(warnings).toContain('Mermaid block column counts are whole numbers; others were rounded.');
    expect(warnings).toContain('Mermaid block spaces are whole numbers from 1; others were dropped.');
  });

  it('writes columns, spans, spaces, groups, and links', () => {
    const text = writeBlockDiagram({ pages: [page(SYSTEM)] }).text;
    expect(text).toContain('block-beta\n  columns 3\n  client("Browser")\n  space\n  gateway{{"Gateway"}}\n  block:services:3\n    columns 2\n');
    expect(text).toContain('  space:2\n  cache(("Cache"))\n  wide["Logs"]:3\n');
    expect(text).toContain('  gateway -- "routes" --> api\n  api -.-> cache\n  worker --- queue\n');
    expect(text).toContain('  style gateway fill:#ffeecc,stroke:#aa6600\n');
  });

  it('names a group whose id looks minted when an edge or a style names it, so both read back onto it', () => {
    const text = 'block-beta\n  block:block-1\n    a\n  end\n  x\n  x --> block-1\n  style block-1 fill:#f00';
    const back = page(writeBlockDiagram(readBlockDiagram(text).document).text);
    expect(back.data.nodes.map((n) => n.id).sort()).toEqual(['a', 'x']);
    const group = back.data.containers![0]!;
    expect(group.colors).toEqual({ fill: '#ff0000' });
    expect(back.data.edges.map((e) => [e.from, e.to])).toEqual([['x', group.id]]);
    expect(writeBlockDiagram(readBlockDiagram('block-beta\n  block\n    a\n  end').document).text).toContain('  block\n');
  });

  it('writes a page laid out some other way as one row', () => {
    const { text } = writeBlockDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100,
      data: { nodes: [{ id: 'a', lines: ['A'], outline: 'stadium' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', label: 'x' }] },
    }] });
    expect(text).toBe('block-beta\n  a(["A"])\n  b[" "]\n  a -- "x" --> b\n');
  });

  it('renames a block whose id the reader takes for a keyword, so it reads back', () => {
    for (const id of ['block', 'space', 'columns']) {
      const text = writeBlockDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id, lines: ['x'] }, { id: 'auto', lines: ['y'] }], edges: [] } }] }).text;
      expect(onlyPage(readBlockDiagram(text).document).data.nodes.map((n) => n.lines)).toEqual([['x'], ['y']]);
    }
  });

  it('reads a block or group named for an Object.prototype member as having no span, space, columns, or brackets', () => {
    const { text } = writeBlockDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100, layout: { name: 'grid', options: { grid: { columns: 2 } } },
      data: { nodes: [{ id: 'constructor', lines: ['A'], outline: 'toString' }], edges: [], containers: [{ id: 'toString', role: 'container', members: ['constructor'] }] },
    }] });
    expect(text).toBe('block-beta\n  columns 2\n  block:toString\n    constructor["A"]\n  end\n');
  });

  it('warns that an end it has no head for was written as an arrow', () => {
    const { warnings } = writeBlockDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', colors: { markerEnd: 'diamond' } }] } }] });
    expect(warnings).toContain('Mermaid block diagram links end in arrows; other ends were written as arrows.');
  });

  it('warns that a link\'s colors were dropped', () => {
    const { warnings } = writeBlockDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', colors: { stroke: '#f00' } }],
    } }] });
    expect(warnings).toContain('Mermaid block diagram links have no styles; their colors were dropped.');
  });
});

/** `text` read, with node `from` renamed `to` in its nodes and edges. */
const renamed = (text: string, from: string, to: string) => {
  const p = page(text);
  const id = (s: string) => (s === from ? to : s);
  const data = { ...p.data, nodes: p.data.nodes.map((n) => ({ ...n, id: id(n.id) })), edges: p.data.edges.map((e) => ({ ...e, from: id(e.from), to: id(e.to) })) };
  return { pages: [{ ...p, data }] };
};

describe('an id Mermaid reads as accessibility text', () => {
  it('is renamed when written, so its line reads back as a statement of the diagram', () => {
    for (const acc of ['accTitle', 'accDescr']) {
      const back = page(writeBlockDiagram(renamed('block-beta\n  x{"d"}\n  b\n  x --> b', 'x', acc)).text);
      expect(back.data.nodes).toHaveLength(2);
      expect(back.data.edges).toHaveLength(1);
    }
  });
});

describe('a space before a block mentioned again', () => {
  it('goes before the next new block, as Mermaid places it, on an items line as on a links line', () => {
    for (const line of ['a b', 'a --> b']) {
      const p = page(`block-beta\n  a\n  space\n  ${line}`);
      expect(p.layout).toMatchObject({ options: { grid: { skips: { b: 1 } } } });
    }
  });
});
