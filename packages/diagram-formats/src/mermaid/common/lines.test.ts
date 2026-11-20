import { describe, expect, it } from 'vitest';
import { Warnings } from '../../graphRead';
import { readPageName, statementsOf } from './lines';

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

  it('skips an empty front matter block', () => {
    const src = statementsOf('---\n---\nclassDiagram\n  class A');
    expect(src.header).toEqual({ text: 'classDiagram', line: 3, indent: 0 });
  });

  it('closes an accDescr block on the line it opens on', () => {
    const src = statementsOf('pie\naccDescr { one line }\n"a" : 1');
    expect(src.accDescr).toBe('one line');
    expect(src.body).toEqual([{ text: '"a" : 1', line: 3, indent: 0 }]);
  });

  it('names the line of an accDescr block never closed, and of a file with no header', () => {
    expect(() => statementsOf('classDiagram\naccDescr {\nnever')).toThrow('Mermaid, line 2: an accDescr block is never closed');
    expect(() => statementsOf('classDiagram\n%%{init: {}\nclass A')).toThrow('Mermaid, line 2: a directive opened here is never closed');
    expect(() => statementsOf('---\ntitle: x\n---\n%% only')).toThrow('Mermaid, line 4: the diagram has no header');
  });
});

describe('readPageName', () => {
  const ACC = 'Mermaid accessible titles were dropped; the page is named by the title.';
  const name = (text: string, own?: string) => {
    const warnings = new Warnings();
    return [readPageName(statementsOf(text), warnings, own), warnings.all()];
  };

  it('names a page by its title statement, else its front matter title, else its accessible title, skipping empty ones', () => {
    expect(name('pie\naccTitle: Acc', 'Own')).toEqual(['Own', [ACC]]);
    expect(name('---\ntitle: Front\n---\npie\naccTitle: Acc', '')).toEqual(['Front', [ACC]]);
    expect(name('---\ntitle:\n---\npie\naccTitle: Acc')).toEqual(['Acc', []]);
  });
});
