import { describe, expect, it } from 'vitest';
import { lexDot } from './lex';

const values = (text: string) => lexDot(text).map((t) => t.value);

describe('lexDot', () => {
  it('reads identifiers, numerals, punctuation, and edge operators', () => {
    expect(values('digraph G { a -> b; c -- -1.5 [x=.5] }')).toEqual(
      ['digraph', 'G', '{', 'a', '->', 'b', ';', 'c', '--', '-1.5', '[', 'x', '=', '.5', ']', '}'],
    );
  });

  it('skips line, block, and preprocessor comments, keeping line numbers', () => {
    const tokens = lexDot('# 1 "file"\ngraph { // one\n/* two\nthree */ a }');
    expect(tokens.map((t) => t.value)).toEqual(['graph', '{', 'a', '}']);
    expect(tokens.map((t) => t.line)).toEqual([2, 2, 4, 4]);
  });

  it('unescapes only the quote in a quoted string, joins continued lines, and concatenates with +', () => {
    const [t] = lexDot('"say \\"hi\\"\\n\\\nthere" + " and more"');
    expect(t).toMatchObject({ kind: 'id', value: 'say "hi"\\nthere and more', quoted: true });
    expect(lexDot('"ends in \\\\" x').map((tok) => tok.value)).toEqual(['ends in \\\\', 'x']);
  });

  it('reads an HTML string to its matching bracket', () => {
    const [t] = lexDot('<<b>bold</b> <i>x</i>>');
    expect(t).toMatchObject({ kind: 'id', value: '<b>bold</b> <i>x</i>', html: true });
  });

  it('lets a quoted string run over lines, and names the line one never closed starts on', () => {
    expect(lexDot('"a\nb" c').map((t) => [t.value, t.line])).toEqual([['a\nb', 1], ['c', 2]]);
    expect(() => lexDot('graph {\n a [label="open\n]')).toThrow(/line 2/);
  });

  it('names the line and the character it cannot read', () => {
    expect(() => lexDot('graph {\n\n a @ b }')).toThrow(/line 3.*"@"/);
  });
});
