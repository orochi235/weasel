/** Counterexamples the replay's property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { replayGitGraph } from './replay';

describe('replayGitGraph, shrunk', () => {
  it('names a commit given no id past an id another commit was given', () => {
    const h = replayGitGraph({ kind: 'gitgraph', commands: [{ kind: 'commit', id: '#2' }, { kind: 'commit' }, { kind: 'commit' }] });
    expect(h.error).toBeUndefined();
    expect(h.commits.map((c) => c.id)).toEqual(['#2', '#1', '#3']);
  });
});
