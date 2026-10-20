import { describe, expect, it } from 'vitest';
import { DIAGRAM_MERMAID } from './format';

describe('DIAGRAM_MERMAID', () => {
  it('recognizes a flowchart by its header, past front matter and comments', () => {
    expect(DIAGRAM_MERMAID.detect('---\ntitle: x\n---\n%% hi\nflowchart LR\nA --> B')).toBe(true);
    expect(DIAGRAM_MERMAID.detect('graph;A-->B')).toBe(true);
    expect(DIAGRAM_MERMAID.detect('graph TD\n A{x}')).toBe(true);
  });

  it('recognizes another Mermaid kind, so reading it can name the kind', () => {
    expect(DIAGRAM_MERMAID.detect('sequenceDiagram\nA->>B: hi')).toBe(true);
  });

  it('refuses a DOT graph that starts the same way', () => {
    expect(DIAGRAM_MERMAID.detect('graph { a -- b }')).toBe(false);
    expect(DIAGRAM_MERMAID.detect('graph G {\n a\n}')).toBe(false);
  });
});
