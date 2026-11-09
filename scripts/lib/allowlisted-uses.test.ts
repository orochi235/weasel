import { describe, expect, it } from 'vitest';
import { judgeUses, matchLines, offendingLines } from './allowlisted-uses.mjs';

describe('matchLines', () => {
  it('reports the line of each match, two on one line twice, skipping comments', () => {
    expect(matchLines('a a\n// a\n/* a\n a */\nb a\n', /\ba\b/g)).toEqual([1, 1, 5]);
  });
});

describe('offendingLines', () => {
  it('reports every use in a file that is not allowlisted', () => {
    expect(offendingLines([3, 9])).toEqual([3, 9]);
  });

  it('lets an allowlisted file keep the uses its entry covers', () => {
    expect(offendingLines([3], 1)).toEqual([]);
  });

  it('reports an allowlisted file that gained a use', () => {
    expect(offendingLines([3, 9], 1)).toEqual([3, 9]);
  });
});

describe('judgeUses', () => {
  const allowed = new Map<string, string | [string, number]>([
    ['a.ts', 'one use'],
    ['b.ts', ['two uses', 2]],
  ]);

  it('passes files holding exactly the uses their entries cover', () => {
    expect(judgeUses(new Map([['a.ts', [4]], ['b.ts', [1, 7]]]), allowed)).toEqual({ offenders: [], stale: [] });
  });

  it('reports each use past an allowance, and every use of an unlisted file', () => {
    expect(judgeUses(new Map([['a.ts', [4, 5]], ['b.ts', [1, 7]], ['c.ts', [2]]]), allowed).offenders).toEqual(['a.ts:4', 'a.ts:5', 'c.ts:2']);
  });

  it('reports an entry covering more uses than its file has, or a file that is gone', () => {
    expect(judgeUses(new Map([['b.ts', [1]]]), allowed).stale).toEqual(['a.ts is allowed 1 and has 0', 'b.ts is allowed 2 and has 1']);
  });
});
