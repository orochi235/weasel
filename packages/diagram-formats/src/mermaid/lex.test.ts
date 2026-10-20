import { describe, expect, it } from 'vitest';
import { lexMermaid, type MermaidToken } from './lex';

const brief = (t: MermaidToken) => {
  switch (t.kind) {
    case 'shape': return `${t.shape}:${t.text}`;
    case 'link': return `link:${t.start ?? ''}${t.stroke}${t.end ?? ''}${t.text !== undefined ? `:${t.text}` : ''}`;
    case 'sep': return ';';
    default: return `${t.kind}:${t.value}`;
  }
};
const lex = (text: string) => lexMermaid(text).tokens.map(brief);

describe('lexMermaid', () => {
  it('reads front matter, directives, and comments apart from the statements', () => {
    const out = lexMermaid('---\ntitle: "A: b"\n---\n%%{init: {}}%%\nflowchart TD\n%% note\nA');
    expect(out.title).toBe('A: b');
    expect(out.directives).toBe(1);
    expect(out.tokens.map((t) => [brief(t), t.line])).toEqual([['word:flowchart', 5], ['rest:TD', 5], [';', 5], ['word:A', 7]]);
  });

  it('reads each node shape, its text quoted or not', () => {
    expect(lex('A[a] B(b) C([c]) D[[d]] E[(e)] F((f)) G(((g))) H>h] I{i} J{{j}} K[/k/] L[\\l\\] M[/m\\] N[\\n/] O["q [x]"]')).toEqual([
      'word:A', 'rect:a', 'word:B', 'rounded:b', 'word:C', 'stadium:c', 'word:D', 'subroutine:d', 'word:E', 'cylinder:e',
      'word:F', 'circle:f', 'word:G', 'double-circle:g', 'word:H', 'asymmetric:h', 'word:I', 'diamond:i', 'word:J', 'hexagon:j',
      'word:K', 'lean-right:k', 'word:L', 'lean-left:l', 'word:M', 'trapezoid:m', 'word:N', 'inv-trapezoid:n', 'word:O', 'rect:q [x]',
    ]);
  });

  it('reads links of every stroke and head, with text inline or piped', () => {
    expect(lex('A-->B --- C -.-> D ==> E ~~~ F <--> G o--o H x--x I ----> J')).toEqual([
      'word:A', 'link:normal>', 'word:B', 'link:normal', 'word:C', 'link:dotted>', 'word:D', 'link:thick>', 'word:E',
      'link:invisible', 'word:F', 'link:<normal>', 'word:G', 'link:onormalo', 'word:H', 'link:xnormalx', 'word:I', 'link:normal>', 'word:J',
    ]);
    expect(lex('A -- go on --> B -. maybe .-> C == "big one" ==> D -->|"why | not"| E')).toEqual([
      'word:A', 'link:normal>:go on', 'word:B', 'link:dotted>:maybe', 'word:C', 'link:thick>:big one', 'word:D', 'link:normal>',
      'pipe:why | not', 'word:E',
    ]);
  });

  it('keeps hyphens and dots inside ids, but not an arrow after one', () => {
    expect(lex('my-node.x-->x-y')).toEqual(['word:my-node.x', 'link:normal>', 'word:x-y']);
  });

  it('reads &, classes, metadata, and the rest of a keyword line', () => {
    expect(lex('A & B:::hot --> C@{ shape: hex, label: "x" }\nstyle A fill:#f00;\nsubgraph s1 [Title]')).toEqual([
      'word:A', 'amp:&', 'word:B', 'class:hot', 'link:normal>', 'word:C', 'meta: shape: hex, label: "x" ', ';',
      'word:style', 'rest:A fill:#f00', ';', 'word:subgraph', 'rest:s1 [Title]',
    ]);
  });

  it('names the line of what it cannot read', () => {
    expect(() => lexMermaid('flowchart TD\nA[open\nB')).toThrow(/Mermaid, line 2/);
    expect(() => lexMermaid('flowchart TD\n\nA --> B ^ C')).toThrow(/line 3.*"\^"/);
  });
});
