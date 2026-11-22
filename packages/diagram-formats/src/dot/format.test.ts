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

  it('refuses a keyword that runs into a name, which the reader would refuse', () => {
    for (const text of ['digraphs {}', 'graphite { }', 'strict graphé { }']) {
      expect(DIAGRAM_DOT.detect(text)).toBe(false);
      expect(() => readDot(text)).toThrow();
    }
    expect(DIAGRAM_DOT.detect('digraph{ a }')).toBe(true);
  });
});

describe('DIAGRAM_DOT header detection', () => {
  it('recognizes a header whose tokens only a comment separates, and a quoted id that continues a line', () => {
    for (const text of ['digraph/* x */G { a }', 'strict/**/digraph { a }', 'digraph "a\\\nb" { a }']) {
      expect(() => readDot(text)).not.toThrow();
      expect(DIAGRAM_DOT.detect(text)).toBe(true);
    }
  });

  it('recognizes an HTML id holding a comment marker, and a quoted id joined with +', () => {
    for (const text of ['digraph <a//b> { x }', 'digraph "a" + "b" { x }', 'digraph <a/*b> { x }']) {
      expect(() => readDot(text)).not.toThrow();
      expect(DIAGRAM_DOT.detect(text)).toBe(true);
    }
  });
});
