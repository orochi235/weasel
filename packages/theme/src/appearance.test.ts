import { describe, expect, it } from 'vitest';
import { EMPHASES, EMPHASIS_FG, GRADE_TOKENS, GRADES, STANCES } from './appearance';
import { resolveTheme } from './resolveTheme';
import { weaselTheme } from './theme';

const tokens = resolveTheme(weaselTheme, { mode: 'dark' }) as Readonly<Record<string, string>>;

describe('appearance value lists', () => {
  it('names no severity among the stances, and no scope', () => {
    for (const gone of ['danger', 'notice', 'important', 'scope']) expect(STANCES).not.toContain(gone);
    expect(STANCES).toContain('clarify');
  });

  it('paints every grade with a token the theme defines', () => {
    for (const grade of GRADES) expect(tokens[GRADE_TOKENS[grade]], grade).toBeDefined();
  });

  it('lends every emphasis a color made of tokens the theme defines', () => {
    for (const emphasis of EMPHASES) {
      const names = [...EMPHASIS_FG[emphasis].matchAll(/var\((--wzl-[a-z-]+)\)/g)].map((m) => m[1]);
      expect(names.length, emphasis).toBeGreaterThan(0);
      for (const name of names) expect(tokens[name], name).toBeDefined();
    }
  });
});
