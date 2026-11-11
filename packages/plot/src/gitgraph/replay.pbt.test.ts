/**
 * A git graph's replay against what a history must be: commits in sequence under unique ids, each parent made
 * before it, the first its branch's head at the time; every commit on one branch's list, in order; the main branch
 * first, the rest by order then by creation. Then the replay of a prefix is a prefix of the replay, and a commit
 * given no id never fails for one another commit holds.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { gitData, runs, tally, timeoutFor } from '../pbt.fixture';
import { replayGitGraph } from './replay';
import type { GitCommand, GitGraphData } from './types';

const RUNS = 400;

/** Ids spelled the way the replay names a commit given none, so the two can meet. */
const withAutoIds: fc.Arbitrary<GitGraphData> = gitData.chain((d) => fc.array(fc.constantFrom('#0', '#1', '#2', '#3', '#4'), { minLength: d.commands.length, maxLength: d.commands.length })
  .map((ids) => ({ ...d, commands: d.commands.map((c, k): GitCommand => (c.kind === 'commit' && c.id !== undefined && k % 2 === 0 ? { ...c, id: ids[k]! } : c)) })));
/** Two branches with a commit each already, so a merge has something to take. */
const forked: fc.Arbitrary<GitGraphData> = gitData.map((d) => ({
  ...d, mainBranch: undefined,
  commands: [{ kind: 'commit' }, { kind: 'branch', name: 'dev' }, { kind: 'commit' }, { kind: 'checkout', name: 'main' }, ...d.commands] as GitCommand[],
}));
const anyGit = fc.oneof(gitData, withAutoIds, forked);

describe('replayGitGraph', () => {
  it('replays a history whose every commit follows its branch\'s head, on one branch, in order', () => {
    const seen = tally();
    fc.assert(fc.property(anyGit, (data) => {
      const h = replayGitGraph(data);
      const main = data.mainBranch ?? 'main';
      const ids = h.commits.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      const heads = new Map<string, string | undefined>();
      for (const b of h.branches) heads.set(b.name, b.fork);
      h.commits.forEach((c, i) => {
        expect(c.seq).toBe(i);
        for (const p of c.parents) expect(ids.indexOf(p)).toBeGreaterThanOrEqual(0);
        for (const p of c.parents) expect(ids.indexOf(p)).toBeLessThan(i);
        const head = heads.get(c.branch);
        expect(c.parents[0]).toBe(head);
        heads.set(c.branch, c.id);
        if (c.parents.length > 1) seen.count('merge');
      });
      const listed = h.branches.flatMap((b) => b.commits.map((id) => [b.name, id] as const));
      expect(listed.length).toBe(h.commits.length);
      for (const b of h.branches) {
        const seqs = b.commits.map((id) => h.commits[ids.indexOf(id)]!);
        expect(seqs.every((c) => c.branch === b.name)).toBe(true);
        expect(seqs.map((c) => c.seq)).toEqual([...seqs.map((c) => c.seq)].sort((x, y) => x - y));
      }
      expect(h.branches[0]?.name).toBe(main);
      const rest = h.branches.slice(1);
      rest.slice(1).forEach((b, i) => {
        const a = rest[i]!;
        if (a.order !== undefined && b.order !== undefined && !Number.isNaN(a.order) && !Number.isNaN(b.order)) expect(a.order).toBeLessThanOrEqual(b.order);
      });
      if (h.error === undefined) seen.count('clean');
    }), runs(RUNS));
    seen.atLeast('merge', 5);
    seen.atLeast('clean', RUNS / 10);
  }, timeoutFor(RUNS, 1));

  it('replays a prefix of the commands to a prefix of the history, and stops at the first that cannot run', () => {
    fc.assert(fc.property(anyGit, fc.nat(), (data, cut) => {
      const whole = replayGitGraph(data);
      const k = data.commands.length === 0 ? 0 : cut % (data.commands.length + 1);
      const part = replayGitGraph({ ...data, commands: data.commands.slice(0, k) });
      expect(whole.commits.slice(0, part.commits.length)).toEqual(part.commits);
      if (whole.error !== undefined) {
        const upTo = replayGitGraph({ ...data, commands: data.commands.slice(0, whole.error.command) });
        expect(upTo.error).toBeUndefined();
        expect(upTo.commits).toEqual(whole.commits);
      }
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('never fails a commit given no id over an id another commit holds', () => {
    const seen = tally();
    fc.assert(fc.property(withAutoIds, (data) => {
      const h = replayGitGraph(data);
      if (h.error === undefined) return;
      const cmd = data.commands[h.error.command]!;
      if (cmd.kind === 'commit' && cmd.id === undefined) seen.count('unnamed');
      expect(cmd.kind === 'commit' && cmd.id === undefined).toBe(false);
      expect(cmd.kind === 'cherry-pick' && /already exists/.test(h.error.message)).toBe(false);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('lays branches out in one order, by their order else their place of creation, whatever orders they hold', () => {
    const order = fc.oneof(fc.integer({ min: -2, max: 6 }), fc.constantFrom(Number.NaN, Infinity, -Infinity, 0.5));
    const names = ['a', 'b', 'c', 'd', 'e'];
    fc.assert(fc.property(fc.array(fc.option(order, { nil: undefined }), { minLength: 5, maxLength: 5 }), (orders) => {
      const commands: GitCommand[] = [{ kind: 'commit' }];
      names.forEach((name, i) => commands.push({ kind: 'branch', name, ...(orders[i] !== undefined ? { order: orders[i] } : {}) }, { kind: 'checkout', name: 'main' }));
      const lanes = replayGitGraph({ kind: 'gitgraph', commands }).branches.map((b) => b.name);
      const rank = (i: number) => (orders[i] !== undefined && !Number.isNaN(orders[i]) ? orders[i]! : i + 1);
      const want = names.map((_, i) => i).sort((x, y) => (rank(x) === rank(y) ? x - y : rank(x) < rank(y) ? -1 : 1)).map((i) => names[i]);
      expect(lanes).toEqual(['main', ...want]);
    }), runs(RUNS));
  });
});
