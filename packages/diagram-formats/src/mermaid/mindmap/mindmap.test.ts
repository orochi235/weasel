import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { parseMindmap } from './parse';
import { readMindmap } from './read';
import { writeMindmap } from './write';

const LAUNCH = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'mindmap', 'launch.mmd'), 'utf8');
const page = (text: string) => onlyPage(readMindmap(text).document);

describe('reading a Mermaid mind map', () => {
  it('reads a page of notation mindmap, laid out radially', () => {
    expect(page(LAUNCH)).toMatchObject({ name: 'Product launch', notation: 'mindmap', layout: { name: 'radial' } });
  });

  it('reads each node with its shape, its own id or one from its place', () => {
    expect(page(LAUNCH).data.nodes.map((n) => [n.id, n.outline, n.lines])).toEqual([
      ['root', 'ellipse', ['Launch']], ['n2', undefined, ['Research']], ['n3', undefined, ['Interviews']], ['n4', undefined, ['Survey']],
      ['plan', 'rect', ['Plan']], ['n6', undefined, ['Timeline']], ['n7', undefined, ['Budget']],
      ['risks', 'cloud', ['Risks']], ['n9', undefined, ['Delays']], ['n10', undefined, ['Costs']],
      ['n11', undefined, ['Marketing']], ['n12', 'roundRect', ['Blog posts']], ['n13', 'hexagon', ['Ads']],
      ['n14', undefined, ['Support']], ['n15', 'cloud', ['Help desk']], ['n16', undefined, ['Docs site']],
    ]);
  });

  it('joins each node to its parent by indentation, with no arrowheads', () => {
    const { edges } = page(LAUNCH).data;
    expect(edges.filter((e) => e.from === 'root').map((e) => e.to)).toEqual(['n2', 'plan', 'risks', 'n11', 'n14']);
    expect(edges.find((e) => e.to === 'n3')).toMatchObject({ from: 'n2', colors: { markerEnd: null } });
  });

  it('warns of icons and classes', () => {
    expect(readMindmap(LAUNCH).warnings).toEqual(['Mermaid mind map icons were dropped.']);
  });

  it('names the line of a second root and of an icon with no node', () => {
    expect(() => parseMindmap('mindmap\n  a\n  b')).toThrow('Mermaid, line 3: a mind map has one root; this line is indented no deeper than it');
    expect(() => parseMindmap('mindmap\n  ::icon(x)')).toThrow('Mermaid, line 2: an icon or class must follow a node');
  });
});

describe('writing a Mermaid mind map', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(LAUNCH);
    const text = writeMindmap({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeMindmap({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes the tree indented, ids only where a node gives its own, and brackets in plain text escaped', () => {
    const text = writeMindmap({ pages: [page(LAUNCH)] }).text;
    expect(text).toContain('mindmap\n  root((Launch))\n    Research\n      Interviews\n');
    expect(text).toContain('    risks))Risks((\n');
    expect(text).toContain('      (Blog posts)\n');
    const odd = writeMindmap({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a', lines: ['f(x)'] }, { id: 'b' }, { id: 'c' }], edges: [{ from: 'a', to: 'b' }] },
    }] });
    expect(odd.text).toContain('  f#40;x#41;\n');
    expect(page(odd.text).data.nodes[0]!.lines).toEqual(['f(x)']);
    expect(odd.warnings).toContain('Mermaid mind maps hold one tree; shapes outside the first root\'s were dropped.');
  });
});
