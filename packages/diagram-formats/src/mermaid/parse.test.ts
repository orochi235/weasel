import { describe, expect, it } from 'vitest';
import { parseMermaid } from './parse';

describe('parseMermaid', () => {
  it('reads the header\'s direction, defaulting to top down', () => {
    expect(parseMermaid('flowchart LR\nA')).toMatchObject({ direction: 'LR' });
    expect(parseMermaid('graph\nA')).toMatchObject({ direction: 'TB' });
    expect(parseMermaid('---\ntitle: T\n---\ngraph TD;A')).toMatchObject({ title: 'T', direction: 'TD' });
  });

  it('reads a chain with & groups, link text, shapes, classes, and metadata', () => {
    const { stmts } = parseMermaid('flowchart TD\nA[a] & B:::hot -->|x| C{c} -.- D@{ shape: hex, label: "d" }');
    expect(stmts).toEqual([{
      kind: 'chain', line: 2,
      groups: [
        [{ id: 'A', shape: 'rect', text: 'a', classes: [], line: 2 }, { id: 'B', classes: ['hot'], line: 2 }],
        [{ id: 'C', shape: 'diamond', text: 'c', classes: [], line: 2 }],
        [{ id: 'D', classes: [], meta: { shape: 'hex', label: 'd' }, line: 2 }],
      ],
      links: [{ stroke: 'normal', end: '>', text: 'x' }, { stroke: 'dotted' }],
    }]);
  });

  it('reads subgraphs, nested, in each of their spellings', () => {
    const { stmts } = parseMermaid('flowchart TD\nsubgraph one [First]\n direction LR\n a\n subgraph two\n b\n end\nend\nsubgraph "Quoted title"\nend\nsubgraph s3["Bracket"]\nend');
    expect(stmts).toMatchObject([
      { kind: 'subgraph', id: 'one', title: 'First', stmts: [{ kind: 'direction', value: 'LR' }, { kind: 'chain' }, { kind: 'subgraph', id: 'two', stmts: [{ kind: 'chain' }] }] },
      { kind: 'subgraph', id: 'Quoted title', title: 'Quoted title', stmts: [] },
      { kind: 'subgraph', id: 's3', title: 'Bracket', stmts: [] },
    ]);
  });

  it('reads style, classDef, class, and linkStyle statements', () => {
    const { stmts } = parseMermaid('flowchart TD\nclassDef a,b fill:#f00, stroke:rgb(1, 2, 3)\nclass x,y a\nstyle x color:#fff\nlinkStyle 0,2 stroke:#0f0\nlinkStyle default color:red');
    expect(stmts).toEqual([
      { kind: 'classDef', names: ['a', 'b'], props: [['fill', '#f00'], ['stroke', 'rgb(1, 2, 3)']], line: 2 },
      { kind: 'class', ids: ['x', 'y'], className: 'a', line: 3 },
      { kind: 'style', id: 'x', props: [['color', '#fff']], line: 4 },
      { kind: 'linkStyle', indexes: [0, 2], props: [['stroke', '#0f0']], line: 5 },
      { kind: 'linkStyle', indexes: 'default', props: [['color', 'red']], line: 6 },
    ]);
  });

  it('refuses other diagram kinds by name, and text with no header', () => {
    expect(() => parseMermaid('sequenceDiagram\nA->>B: hi')).toThrow(/Mermaid, line 1: .*sequenceDiagram.*flowcharts/);
    expect(() => parseMermaid('A --> B')).toThrow(/line 1.*flowchart/);
  });

  it('names the line of an unexpected token and of an unclosed subgraph', () => {
    expect(() => parseMermaid('flowchart TD\nA -->\nB')).toThrow(/line 2/);
    expect(() => parseMermaid('flowchart TD\nsubgraph s\nA')).toThrow(/line 2.*"end"/);
    expect(() => parseMermaid('flowchart TD\nA\nend')).toThrow(/line 3/);
  });
});
