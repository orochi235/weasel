import { describe, expect, it } from 'vitest';
import { parseInline } from './parseInline';

describe('parseInline', () => {
  it('leaves two globs on one line as written', () => {
    for (const line of ['Copies src/*.ts to lib/*.js', 'Matches "*.ts" or "*.js"', 'Globs src/**/*.ts and lib/**/*.js']) {
      expect(parseInline(line)).toEqual([{ type: 'text', text: line }]);
    }
  });

  it('still opens a mark before punctuation after a space', () => {
    expect(parseInline('say *"this"* now')).toEqual([
      { type: 'text', text: 'say ' },
      { type: 'em', children: [{ type: 'text', text: '"this"' }] },
      { type: 'text', text: ' now' },
    ]);
  });

  it('keeps a code span whole inside a mark', () => {
    expect(parseInline('*the `**` operator*')).toEqual([
      { type: 'em', children: [{ type: 'text', text: 'the ' }, { type: 'code', text: '**' }, { type: 'text', text: ' operator' }] },
    ]);
    expect(parseInline('**see `a**b`**')).toEqual([
      { type: 'strong', children: [{ type: 'text', text: 'see ' }, { type: 'code', text: 'a**b' }] },
    ]);
  });

  it('keeps balanced parentheses in a link address', () => {
    expect(parseInline('[x](https://en.wikipedia.org/wiki/Foo_(bar)) after')).toEqual([
      { type: 'link', href: 'https://en.wikipedia.org/wiki/Foo_(bar)', children: [{ type: 'text', text: 'x' }] },
      { type: 'text', text: ' after' },
    ]);
  });

  it('reads a triple mark as emphasis around strong, with no stray asterisk', () => {
    expect(parseInline('***important*** now')).toEqual([
      { type: 'em', children: [{ type: 'strong', children: [{ type: 'text', text: 'important' }] }] },
      { type: 'text', text: ' now' },
    ]);
  });

  it('reads a run of marks that never close in time linear in its length', () => {
    const fastest = (src: string): number => {
      let best = Infinity;
      for (let i = 0; i < 5; i++) {
        const t = performance.now();
        parseInline(src);
        best = Math.min(best, performance.now() - t);
      }
      return best;
    };
    for (const mark of ['[', '[a', '**a ', '~~a ']) {
      const short = mark.repeat(Math.ceil(5_000 / mark.length));
      const long = mark.repeat(Math.ceil(40_000 / mark.length));
      expect(parseInline(long)).toEqual([{ type: 'text', text: long }]);
      fastest(short);
      // Eight times the text: linear reads take about 8 times as long, quadratic ones 64.
      expect(fastest(long) / Math.max(fastest(short), 0.05)).toBeLessThan(24);
    }
  });
});
