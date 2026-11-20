import { describe, expect, it } from 'vitest';
import { DIAGRAM_DOT } from './format';
import { readDot } from './read';

describe('DIAGRAM_DOT', () => {
  it('recognizes a DOT graph by its header, past comments', () => {
    expect(DIAGRAM_DOT.detect('// hi\n/* there */\nstrict digraph "x y" { a }')).toBe(true);
    expect(DIAGRAM_DOT.detect('# line 1\nGraph {}')).toBe(true);
  });

  it('recognizes a graph the reader reads: an indented `#` line, and an HTML id', () => {
    for (const text of ['  # generated\ndigraph { a }', 'digraph <G> { a -> b }', 'digraph <<b>G</b>> { a }']) {
      expect(DIAGRAM_DOT.detect(text)).toBe(true);
      expect(() => readDot(text)).not.toThrow();
    }
    expect(DIAGRAM_DOT.detect('digraph <G { a }')).toBe(false);
  });

  it('refuses a Mermaid flowchart that starts the same way', () => {
    expect(DIAGRAM_DOT.detect('graph TD\n  A{Choice} --> B')).toBe(false);
    expect(DIAGRAM_DOT.detect('{"format": "weasel-diagram"}')).toBe(false);
  });
});
