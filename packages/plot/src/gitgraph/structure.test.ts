import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import {
  gitBranchNames, insertGitCommand, moveGitCommand, removeGitCommand, setGitCommandField, setGitCommandKind, setGitMainBranch,
  setGitOrientation,
} from './structure';
import { replayGitGraph } from './replay';
import type { GitGraphData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: GitGraphData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);
const EMPTY: GitGraphData = { kind: 'gitgraph', commands: [] };

describe('gitgraph structure', () => {
  it('builds a history from nothing: commits, a branch, a checkout, a merge', () => {
    let d = EMPTY;
    for (let i = 0; i < 5; i++) d = insertGitCommand(d, i);
    d = setGitCommandKind(d, 1, 'branch');
    d = setGitCommandField(d, 2, 'id', 'c2');
    d = setGitCommandKind(d, 3, 'checkout');
    d = setGitCommandKind(d, 4, 'merge');
    expect(d.commands).toEqual([
      { kind: 'commit' }, { kind: 'branch', name: 'branch-1' }, { kind: 'commit', id: 'c2' }, { kind: 'checkout', name: 'main' },
      { kind: 'merge', branch: 'branch-1' },
    ]);
    expect(gitBranchNames(d)).toEqual(['main', 'branch-1']);
    compiles(d);
  });

  it('turns a command into another kind, keeping the fields both hold', () => {
    const d: GitGraphData = { kind: 'gitgraph', commands: [{ kind: 'commit', id: 'x', tag: 'v1', message: 'm' }] };
    expect(setGitCommandKind(d, 0, 'merge').commands[0]).toEqual({ kind: 'merge', branch: 'main', id: 'x', tag: 'v1' });
    expect(setGitCommandKind(d, 0, 'cherry-pick').commands[0]).toEqual({ kind: 'cherry-pick', id: '', tag: 'v1' });
  });

  it('sets and drops fields, refusing ones a kind does not hold or needs', () => {
    const d: GitGraphData = { kind: 'gitgraph', commands: [{ kind: 'commit' }, { kind: 'branch', name: 'dev' }] };
    expect(setGitCommandField(d, 0, 'type', 'HIGHLIGHT').commands[0]).toEqual({ kind: 'commit', type: 'HIGHLIGHT' });
    expect(setGitCommandField(setGitCommandField(d, 1, 'order', 2), 1, 'order', undefined)).toEqual(d);
    expect(() => setGitCommandField(d, 0, 'name', 'x')).toThrow(/holds no name/);
    expect(() => setGitCommandField(d, 1, 'name', undefined)).toThrow(/needs its name/);
    expect(() => setGitCommandField(d, 0, 'type', 'ODD')).toThrow(/no commit type/);
    expect(() => setGitCommandField(d, 1, 'order', '2')).toThrow(/takes a number/);
  });

  it('moves and removes commands, and sets the graph\'s options', () => {
    const d: GitGraphData = { kind: 'gitgraph', commands: [{ kind: 'commit', id: 'a' }, { kind: 'commit', id: 'b' }, { kind: 'checkout', name: 'main' }] };
    expect(moveGitCommand(d, 0, 1).commands.map((c) => (c as { id?: string }).id)).toEqual(['b', 'a', undefined]);
    expect(removeGitCommand(d, 0).commands).toHaveLength(2);
    expect(setGitOrientation(setGitOrientation(d, 'TB'), 'LR')).toEqual(d);
    const trunk = setGitMainBranch(d, 'trunk');
    expect(trunk).toMatchObject({ mainBranch: 'trunk', commands: [{}, {}, { kind: 'checkout', name: 'trunk' }] });
    expect(setGitMainBranch(trunk, 'main')).toEqual(d);
    expect(() => setGitMainBranch({ ...d, commands: [{ kind: 'branch', name: 'dev' }] }, 'dev')).toThrow(/already called "dev"/);
    compiles(trunk);
  });

  it('carries a branch\'s new name into the checkouts and merges after it, refusing one another branch holds', () => {
    const d: GitGraphData = { kind: 'gitgraph', commands: [
      { kind: 'commit' }, { kind: 'branch', name: 'dev' }, { kind: 'commit' }, { kind: 'checkout', name: 'main' }, { kind: 'merge', branch: 'dev' },
      { kind: 'checkout', name: 'dev' }, { kind: 'branch', name: 'other' },
    ] };
    const renamed = setGitCommandField(d, 1, 'name', 'feature');
    expect(renamed.commands.slice(4, 6)).toEqual([{ kind: 'merge', branch: 'feature' }, { kind: 'checkout', name: 'feature' }]);
    expect(replayGitGraph(renamed).error).toBeUndefined();
    expect(() => setGitCommandField(d, 1, 'name', 'other')).toThrow(/already called "other"/);
    expect(() => setGitCommandField(d, 1, 'name', 'main')).toThrow(/already called "main"/);
  });

  it('fills a new merge or cherry-pick from the history before it', () => {
    const d: GitGraphData = { kind: 'gitgraph', commands: [
      { kind: 'commit', id: 'm1' }, { kind: 'branch', name: 'dev' }, { kind: 'commit', id: 'd1' }, { kind: 'commit' },
      { kind: 'checkout', name: 'main' }, { kind: 'commit' }, { kind: 'branch', name: 'late' },
    ] };
    expect(setGitCommandKind(d, 3, 'merge').commands[3]).toEqual({ kind: 'merge', branch: 'main' });
    expect(setGitCommandKind(d, 5, 'merge').commands[5]).toEqual({ kind: 'merge', branch: 'dev' });
    expect(setGitCommandKind(d, 3, 'cherry-pick').commands[3]).toEqual({ kind: 'cherry-pick', id: 'm1' });
    expect(setGitCommandKind(d, 5, 'cherry-pick').commands[5]).toEqual({ kind: 'cherry-pick', id: 'd1' });
    for (const [at, kind] of [[3, 'merge'], [5, 'merge'], [3, 'cherry-pick'], [5, 'cherry-pick']] as const) {
      expect(replayGitGraph(setGitCommandKind(d, at, kind)).error).toBeUndefined();
    }
  });
});
