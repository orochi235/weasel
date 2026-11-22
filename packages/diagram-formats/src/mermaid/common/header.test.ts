import { describe, expect, it } from 'vitest';
import { frontMatter, headerWord } from './header';

describe('headerWord', () => {
  it('skips front matter exactly where frontMatter reads one', () => {
    expect(headerWord('---\ntitle: x\n---\nflowchart TD')).toEqual({ word: 'flowchart', text: 'flowchart TD', line: 4 });
    expect(frontMatter('---\nflowchart TD').lines).toBe(0);
    expect(headerWord('---\nflowchart TD')).toEqual({ word: '---', text: '---', line: 1 });
  });
});
