import { describe, expect, it } from 'vitest';
import { statementsOf } from './lines';

describe('statementsOf', () => {
  it('reads front matter, directives, comments, and accessibility text off the statements, keeping each one\'s line and indent', () => {
    const src = statementsOf([
      '---', 'title: "A \\"b\\""', '---', '%%{init: {', '  "theme": "dark"}}%%', 'mindmap', '%% a comment',
      'accTitle: Short', 'accDescr {', '  Two', '  lines }', '  root', '\tchild',
    ].join('\n'));
    expect(src).toMatchObject({ title: 'A "b"', accTitle: 'Short', accDescr: 'Two\nlines', directives: 1 });
    expect(src.header).toEqual({ text: 'mindmap', line: 6, indent: 0 });
    expect(src.body).toEqual([{ text: 'root', line: 12, indent: 2 }, { text: 'child', line: 13, indent: 4 }]);
  });

  it('names the line of an accDescr block never closed, and of a file with no header', () => {
    expect(() => statementsOf('classDiagram\naccDescr {\nnever')).toThrow('Mermaid, line 2: an accDescr block is never closed');
    expect(() => statementsOf('---\ntitle: x\n---\n%% only')).toThrow('Mermaid, line 4: the diagram has no header');
  });
});
