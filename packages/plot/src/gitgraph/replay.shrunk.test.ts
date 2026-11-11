/** Counterexamples the replay's property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { replayGitGraph } from './replay';
import type { GitCommand } from './types';

describe('replayGitGraph, shrunk', () => {
  it('names a commit given no id past an id another commit was given', () => {
    const h = replayGitGraph({ kind: 'gitgraph', commands: [{ kind: 'commit', id: '#2' }, { kind: 'commit' }, { kind: 'commit' }] });
    expect(h.error).toBeUndefined();
    expect(h.commits.map((c) => c.id)).toEqual(['#2', '#1', '#3']);
  });

  it('places a branch whose order is NaN as one with none', () => {
    const orders = [Number.NaN, 5, 1, Number.NaN, 0];
    const commands: GitCommand[] = [{ kind: 'commit' }];
    ['a', 'b', 'c', 'd', 'e'].forEach((name, i) => commands.push({ kind: 'branch', name, order: orders[i] }, { kind: 'checkout', name: 'main' }));
    expect(replayGitGraph({ kind: 'gitgraph', commands }).branches.map((b) => b.name)).toEqual(['main', 'e', 'a', 'c', 'd', 'b']);
  });
});
