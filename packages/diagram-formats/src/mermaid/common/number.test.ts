import { describe, expect, it } from 'vitest';
import { DIAGRAM_MERMAID } from '../format';

describe('Mermaid numbers', () => {
  it.each([
    ['pie', 'pie\n  "a" : 1e400', 2],
    ['sankey', 'sankey-beta\na,b,1e400', 2],
    ['xychart', 'xychart-beta\n  bar [1, 1e400]', 2],
    ['radar', 'radar-beta\n  axis a, b\n  curve c{1, 1e400}', 3],
    ['quadrant', 'quadrantChart\n  P: [0.5, 0.5] radius: 1e400', 2],
  ])('refuses a %s number too large to hold, which would be written back as Infinity', (_, text, line) => {
    expect(() => DIAGRAM_MERMAID.read!(text)).toThrow(`Mermaid, line ${line}: "1e400"`);
  });

  it('reads a large number that still fits', () => {
    expect(() => DIAGRAM_MERMAID.read!('pie\n  "a" : 1e300')).not.toThrow();
  });
});
