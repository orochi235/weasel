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
});
