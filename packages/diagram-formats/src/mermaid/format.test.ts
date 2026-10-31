import { describe, expect, it } from 'vitest';
import type { GraphPage } from '../document';
import { DIAGRAM_MERMAID } from './format';

const read = (text: string) => DIAGRAM_MERMAID.read!(text) as Awaited<ReturnType<NonNullable<typeof DIAGRAM_MERMAID.read>>>;
const pageOf = (text: string) => read(text).document.pages[0] as GraphPage;

describe('DIAGRAM_MERMAID', () => {
  it('recognizes a flowchart by its header, past front matter and comments', () => {
    expect(DIAGRAM_MERMAID.detect('---\ntitle: x\n---\n%% hi\nflowchart LR\nA --> B')).toBe(true);
    expect(DIAGRAM_MERMAID.detect('graph;A-->B')).toBe(true);
    expect(DIAGRAM_MERMAID.detect('graph TD\n A{x}')).toBe(true);
  });

  it('recognizes every other Mermaid kind, so reading one it does not read can name the kind', () => {
    expect(DIAGRAM_MERMAID.detect('sequenceDiagram\nA->>B: hi')).toBe(true);
    expect(DIAGRAM_MERMAID.detect('%%{init: {}}%%\nclassDiagram\nA <|-- B')).toBe(true);
  });

  it('refuses a DOT graph that starts the same way', () => {
    expect(DIAGRAM_MERMAID.detect('graph { a -- b }')).toBe(false);
    expect(DIAGRAM_MERMAID.detect('graph G {\n a\n}')).toBe(false);
  });

  it('reads each kind by its header, setting the notation it models', () => {
    expect(pageOf('flowchart TD\nA --> B').notation).toBeUndefined();
    expect(pageOf('classDiagram\nA <|-- B').notation).toBe('class');
    expect(pageOf('stateDiagram-v2\n[*] --> A').notation).toBe('state');
    expect(pageOf('stateDiagram\n[*] --> A').notation).toBe('state');
    expect(pageOf('erDiagram\nA ||--o{ B : has').notation).toBe('er');
    expect(pageOf('mindmap\n  root').notation).toBe('mindmap');
    expect(pageOf('requirementDiagram\nelement e {\n}').notation).toBe('requirement');
    expect(pageOf('block-beta\n  a b').notation).toBe('block');
    expect(pageOf('architecture-beta\n  service a[A]').notation).toBe('architecture');
    expect(pageOf('C4Context\n  Person(a, "A")').notation).toBe('c4-context');
    expect(pageOf('C4Deployment\n  Deployment_Node(n, "N")').notation).toBe('c4-deployment');
    expect(pageOf('kanban\n  todo[Todo]').notation).toBe('kanban');
  });

  it('refuses a kind it does not read, naming the kind and the line', () => {
    expect(() => read('%% a comment\nzenuml\n  A.b()'))
      .toThrow(/^Mermaid, line 2: zenuml diagrams are not read; only flowchart, classDiagram, .* are$/);
    expect(() => read('A --> B')).toThrow(/line 1.*flowchart/);
  });

  it('writes a graph page in the kind its notation names, and a flowchart when it names none or one it has not', () => {
    const write = (notation: string | undefined) => DIAGRAM_MERMAID.write!({
      pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, ...(notation !== undefined ? { notation } : {}), data: { nodes: [{ id: 'a' }], edges: [] } }],
    });
    expect(write(undefined).text).toMatch(/^flowchart TD\n/);
    expect(write('class').text).toMatch(/^classDiagram\n/);
    expect(write('state').text).toMatch(/^stateDiagram-v2\n/);
    expect(write('er').text).toMatch(/^erDiagram\n/);
    expect(write('mindmap').text).toMatch(/^mindmap\n/);
    expect(write('requirement').text).toMatch(/^requirementDiagram\n/);
    expect(write('block').text).toMatch(/^block-beta\n/);
    expect(write('architecture').text).toMatch(/^architecture-beta\n/);
    expect(write('c4-dynamic').text).toMatch(/^C4Dynamic\n/);
    expect(write('kanban').text).toMatch(/^kanban\n/);
    expect(write('bpmn').warnings[0]).toBe('Mermaid has no bpmn diagram; the page was written as a flowchart.');
  });
});
