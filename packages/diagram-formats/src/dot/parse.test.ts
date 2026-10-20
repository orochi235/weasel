import { describe, expect, it } from 'vitest';
import { parseDot } from './parse';

describe('parseDot', () => {
  it('reads the header: strict, the graph kind, and the id', () => {
    expect(parseDot('strict digraph "My graph" {}')).toMatchObject({ strict: true, directed: true, id: 'My graph', stmts: [] });
    expect(parseDot('GRAPH { }')).toMatchObject({ strict: false, directed: false });
  });

  it('reads node, attribute, and assignment statements with their lists', () => {
    const g = parseDot('digraph { rankdir=LR; node [shape=box, color=red; style=filled] [width=2]\n a [label="A"] }');
    expect(g.stmts).toEqual([
      { kind: 'set', key: 'rankdir', value: { value: 'LR' }, line: 1 },
      { kind: 'attr', target: 'node', attrs: [
        { key: 'shape', value: { value: 'box' } }, { key: 'color', value: { value: 'red' } },
        { key: 'style', value: { value: 'filled' } }, { key: 'width', value: { value: '2' } },
      ], line: 1 },
      { kind: 'node', node: { id: 'a', line: 2 }, attrs: [{ key: 'label', value: { value: 'A', quoted: true } }], line: 2 },
    ]);
  });

  it('reads an edge chain with ports and compass points', () => {
    const g = parseDot('digraph { a:p1:ne -> b:s -> c [label=x] }');
    expect(g.stmts[0]).toMatchObject({
      kind: 'edge',
      ends: [{ id: 'a', port: 'p1', compass: 'ne' }, { id: 'b', compass: 's' }, { id: 'c' }],
      attrs: [{ key: 'label' }],
    });
  });

  it('reads subgraphs, named, anonymous, and as edge ends', () => {
    const g = parseDot('digraph { subgraph cluster_a { label=A; x } { y z } -> w; subgraph { q } }');
    expect(g.stmts.map((s) => s.kind)).toEqual(['subgraph', 'edge', 'subgraph']);
    expect(g.stmts[0]).toMatchObject({ id: 'cluster_a', stmts: [{ kind: 'set', key: 'label' }, { kind: 'node' }] });
    expect(g.stmts[1]).toMatchObject({ ends: [{ kind: 'subgraph', stmts: [{ kind: 'node' }, { kind: 'node' }] }, { id: 'w' }] });
  });

  it('refuses the wrong edge operator for the graph kind, naming the line', () => {
    expect(() => parseDot('graph {\n a -> b }')).toThrow(/line 2.*"--"/);
  });

  it('names the line of an unexpected token, and of a missing close', () => {
    expect(() => parseDot('digraph {\n a [label=]\n}')).toThrow(/line 2/);
    expect(() => parseDot('digraph {\n a')).toThrow(/line 2.*end/);
    expect(() => parseDot('flowchart TD')).toThrow(/line 1.*graph/);
  });
});
