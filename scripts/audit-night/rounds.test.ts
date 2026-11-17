import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { chapman, isSettled, nextRound, pickAreas, readPasses } from './rounds.mjs';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A repo root holding `docs/audits/round-<N>/<id>/area.json` for each pass. */
const fixture = (passes: { round: number; id: string; distinct: number; files: string[]; commit?: string; fixCommits?: string[] }[]) => {
  const root = mkdtempSync(join(tmpdir(), 'audit-night-'));
  dirs.push(root);
  for (const { round, ...pass } of passes) {
    const dir = join(root, 'docs/audits', `round-${round}`, pass.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'area.json'), JSON.stringify({ commit: `c${round}`, fixCommits: [], ...pass }));
  }
  return root;
};

describe('chapman', () => {
  it('is (a+1)(b+1)/(m+1) − 1', () => {
    expect(chapman(10, 8, 4)).toBeCloseTo(18.8);
    expect(chapman(0, 0, 0)).toBe(0);
    expect(chapman(3, 3, 3)).toBe(3);
  });
});

describe('nextRound', () => {
  it('follows the highest number used by a round directory, the hardening record, or a branch', () => {
    expect(nextRound({ roundDirs: ['round-12', 'partition.json'] })).toBe(13);
    expect(nextRound({ hardening: '| rounds 28–30; method below |\n| (audit round 15) |' })).toBe(31);
    expect(nextRound({ branches: ['main', 'audit30-ui', 'batch/2026-11-17-audit33', 'audit-night'] })).toBe(34);
    expect(nextRound({})).toBe(1);
  });
});

describe('pickAreas', () => {
  const area = (id: string, files = [`${id}.ts`]) => ({ id, files });
  const never = () => false;

  it('takes never-audited areas first in partition order, then the longest since their last pass', () => {
    const root = fixture([
      { round: 31, id: 'b', distinct: 5, files: ['b.ts'] },
      { round: 32, id: 'a', distinct: 5, files: ['a.ts'] },
    ]);
    const picked = pickAreas({ areas: ['a', 'b', 'c', 'd'].map((id) => area(id)), passes: readPasses(root), touched: never, count: 3 }).picked;
    expect(picked).toEqual(['c', 'd', 'b']);
  });

  it('skips an area settled by two quiet passes on unchanged files, until its files change', () => {
    const root = fixture([
      { round: 31, id: 'a', distinct: 1, files: ['a.ts'] },
      { round: 32, id: 'a', distinct: 0, files: ['a.ts'] },
    ]);
    const passes = readPasses(root);
    expect(pickAreas({ areas: [area('a')], passes, touched: never, count: 5 })).toEqual({ picked: [], settled: ['a'] });
    expect(pickAreas({ areas: [area('a')], passes, touched: () => true, count: 5 }).picked).toEqual(['a']);
  });

  it('does not settle on one quiet pass, a loud pass, or a changed file list', () => {
    const passes = readPasses(fixture([
      { round: 31, id: 'one', distinct: 0, files: ['one.ts'] },
      { round: 31, id: 'loud', distinct: 2, files: ['loud.ts'] },
      { round: 32, id: 'loud', distinct: 0, files: ['loud.ts'] },
      { round: 31, id: 'moved', distinct: 0, files: ['moved.ts'] },
      { round: 32, id: 'moved', distinct: 0, files: ['moved.ts'] },
    ]));
    const areas = [area('one'), area('loud'), area('moved', ['moved.ts', 'new.ts'])];
    expect(pickAreas({ areas, passes, touched: never, count: 5 }).settled).toEqual([]);
  });

  it('ignores the passes\' own fix commits when asking whether files changed', () => {
    const passes = readPasses(fixture([
      { round: 31, id: 'a', distinct: 1, files: ['a.ts'], commit: 'base', fixCommits: ['fix1'] },
      { round: 32, id: 'a', distinct: 0, files: ['a.ts'] },
    ]));
    const seen: unknown[] = [];
    isSettled(area('a'), passes.get('a'), (files: string[], from: string, exclude: string[]) => (seen.push({ files, from, exclude }), false));
    expect(seen).toEqual([{ files: ['a.ts'], from: 'base', exclude: ['fix1'] }]);
  });
});
