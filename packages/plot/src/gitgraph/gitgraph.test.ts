import { describe, expect, it } from 'vitest';
import { PLOT_THEME, seriesColor } from '../theme';
import { compileGitGraph } from './compile';
import { setGitTag } from './edit';
import { gitgraphEditor } from './editor';
import { replayGitGraph } from './replay';
import type { GitCommand, GitGraphData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 800, height: 300 };

const HISTORY: GitGraphData = {
  kind: 'gitgraph',
  title: 'Release',
  commands: [
    { kind: 'commit', id: 'init' },
    { kind: 'branch', name: 'develop', order: 2 },
    { kind: 'commit', type: 'REVERSE' },
    { kind: 'branch', name: 'hotfix', order: 1 },
    { kind: 'commit', id: 'fix', tag: 'v1.0.1', type: 'HIGHLIGHT' },
    { kind: 'checkout', name: 'main' },
    { kind: 'merge', branch: 'hotfix', tag: 'v1.1' },
    { kind: 'checkout', name: 'develop' },
    { kind: 'cherry-pick', id: 'fix' },
  ],
};

const withCommands = (commands: GitCommand[]): GitGraphData => ({ kind: 'gitgraph', commands });

const byKey = (data: GitGraphData, size = SIZE) => {
  const { marks, layout } = compileGitGraph(data, size, PLOT_THEME, measure);
  return { layout, marks, get: (key: string) => marks.find((m) => m.key === key) };
};

const centerOf = (pose: { x: number; y: number; width: number; height: number }) => ({ x: pose.x + pose.width / 2, y: pose.y + pose.height / 2 });

describe('replayGitGraph', () => {
  it('makes a commit per commit, merge and cherry-pick, on the branch checked out', () => {
    const h = replayGitGraph(HISTORY);
    expect(h.error).toBeUndefined();
    expect(h.commits.map((c) => [c.id, c.branch, c.parents])).toEqual([
      ['init', 'main', []],
      ['#1', 'develop', ['init']],
      ['fix', 'hotfix', ['#1']],
      ['#3', 'main', ['init', 'fix']],
      ['#4', 'develop', ['#1']],
    ]);
    expect(h.commits[4]!.source).toBe('fix');
    expect(h.branches.map((b) => [b.name, b.fork])).toEqual([['main', undefined], ['hotfix', '#1'], ['develop', 'init']]);
  });

  it('stops at the first command that cannot run, as Mermaid does', () => {
    const error = (commands: GitCommand[]) => replayGitGraph(withCommands(commands)).error;
    expect(error([{ kind: 'checkout', name: 'dev' }])).toEqual({ command: 0, message: 'cannot check out "dev": there is no such branch; create it with "branch dev"' });
    expect(error([{ kind: 'branch', name: 'main' }])!.message).toBe('a branch "main" already exists; check it out instead');
    expect(error([{ kind: 'commit' }, { kind: 'merge', branch: 'main' }])!.message).toBe('"main" cannot be merged into itself');
    expect(error([{ kind: 'branch', name: 'b' }, { kind: 'checkout', name: 'main' }, { kind: 'commit' }, { kind: 'merge', branch: 'b' }])!.message)
      .toBe('cannot merge "b": it has no commits');
    expect(error([{ kind: 'commit' }, { kind: 'merge', branch: 'x' }])!.message).toBe('cannot merge "x": there is no such branch');
    expect(error([{ kind: 'commit' }, { kind: 'branch', name: 'b' }, { kind: 'checkout', name: 'main' }, { kind: 'merge', branch: 'b' }])!.message)
      .toBe('cannot merge "b" into "main": both have the same head');
    expect(error([{ kind: 'commit', id: 'a' }, { kind: 'cherry-pick', id: 'a' }])!.message).toBe('cannot cherry-pick "a": it is already on "main"');
    expect(error([{ kind: 'cherry-pick', id: 'z' }])!.message).toBe('cannot cherry-pick "z": there is no such commit');
    expect(error([{ kind: 'commit', id: 'a' }, { kind: 'commit', id: 'a' }])).toEqual({ command: 1, message: 'a commit "a" already exists' });
    const merged = HISTORY.commands.slice(0, 7);
    expect(error([...merged, { kind: 'checkout', name: 'develop' }, { kind: 'merge', branch: 'main', id: 'm' }, { kind: 'checkout', name: 'hotfix' }, { kind: 'cherry-pick', id: 'm' }])!.message)
      .toBe('cherry-picking the merge "m" needs a parent, one of "#1", "#3"');
  });

  it('orders lanes by order, then as created, the main branch first', () => {
    const h = replayGitGraph(withCommands([{ kind: 'branch', name: 'a' }, { kind: 'branch', name: 'b', order: 0 }]));
    expect(h.branches.map((b) => b.name)).toEqual(['main', 'b', 'a']);
    expect(replayGitGraph({ ...withCommands([]), mainBranch: 'trunk' }).branches[0]!.name).toBe('trunk');
  });
});

describe('compileGitGraph', () => {
  it('puts commits in sequence left to right, each on its branch\'s lane', () => {
    const { layout, get } = byKey(HISTORY);
    const [init, onDevelop, fix] = layout.points;
    expect(onDevelop!.x).toBeGreaterThan(init!.x);
    expect(fix!.x).toBeGreaterThan(onDevelop!.x);
    expect(init!.y).toBe(layout.lanes[0]);
    expect(fix!.y).toBe(layout.lanes[1]);
    expect(onDevelop!.y).toBe(layout.lanes[2]);
    const commit = get('commit:0')!;
    expect(commit.data.plotMark).toEqual({ kind: 'point', datum: { command: 0 } });
    expect(centerOf(commit.pose)).toEqual(init);
    expect(commit.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 0));
  });

  it('draws a highlight as a square and a revert crossed', () => {
    const { get } = byKey(HISTORY);
    expect(get('commit:4')!.data.plotMark.kind).toBe('bar');
    expect(get('commit:4')!.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 1));
    expect(get('commit:2:cross:0')!.data.plotMark.kind).toBe('rule');
    expect(get('commit:2:cross:1')).toBeDefined();
  });

  it('draws each branch from its fork, and merge and cherry-pick links from their source', () => {
    const { layout, get } = byKey(HISTORY);
    const develop = get('branch:2')!;
    expect(develop.data.stroke?.paint.color).toBe(seriesColor(PLOT_THEME, 2));
    expect(develop.pose.y).toBeCloseTo(layout.points[0]!.y);
    const merge = get('merge:6')!;
    expect(merge.data.stroke?.paint.color).toBe(seriesColor(PLOT_THEME, 1));
    expect(merge.pose.x).toBeCloseTo(layout.points[2]!.x);
    expect(merge.pose.x + merge.pose.width).toBeCloseTo(layout.points[3]!.x);
    expect(get('pick:8')!.data.stroke?.dash).toEqual([4, 3]);
  });

  it('labels branches at their lane\'s start, given ids, and tags, which edit in place', () => {
    const { layout, get } = byKey(HISTORY);
    const label = get('branch:1:label')!;
    expect(label.data.text).toBe('hotfix');
    expect(centerOf(label.pose).y).toBeCloseTo(layout.lanes[1]!);
    expect(label.pose.x + label.pose.width).toBeLessThan(layout.points[0]!.x);
    expect(get('commit:0:id')!.data.text).toBe('init');
    expect(get('commit:2:id')).toBeUndefined();
    const tag = get('commit:6:tag')!;
    expect(tag.data.text).toBe('v1.1');
    expect(tag.data.plotMark.datum).toEqual({ edit: 'tag', command: 6 });
    expect(tag.pose.y + tag.pose.height).toBeLessThan(layout.points[3]!.y);
  });

  it('runs commits down and lanes across top to bottom, and up from the bottom', () => {
    const tb = byKey({ ...HISTORY, orientation: 'TB' }).layout;
    expect(tb.points[1]!.y).toBeGreaterThan(tb.points[0]!.y);
    expect(tb.points[0]!.x).toBe(tb.lanes[0]);
    const bt = byKey({ ...HISTORY, orientation: 'BT' });
    expect(bt.layout.points[1]!.y).toBeLessThan(bt.layout.points[0]!.y);
    expect(bt.get('branch:0:label')!.pose.y).toBeGreaterThan(bt.layout.points[0]!.y);
  });

  it('draws what ran before a command that cannot, and does not throw on an empty graph or a tiny box', () => {
    const broken = byKey(withCommands([{ kind: 'commit' }, { kind: 'checkout', name: 'nope' }, { kind: 'commit' }]));
    expect(broken.layout.points).toHaveLength(1);
    expect(byKey(withCommands([])).get('branch:0:label')!.data.text).toBe('main');
    expect(() => byKey(HISTORY, { width: 3, height: 3 })).not.toThrow();
  });

  it('keeps every key unique', () => {
    const keys = byKey(HISTORY).marks.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('gitgraph edits', () => {
  it('setGitTag sets, replaces and removes a tag', () => {
    expect(setGitTag(HISTORY, 0, ' v0 ').commands[0]).toEqual({ kind: 'commit', id: 'init', tag: 'v0' });
    expect(setGitTag(HISTORY, 4, '').commands[4]).toEqual({ kind: 'commit', id: 'fix', type: 'HIGHLIGHT' });
    expect(setGitTag(HISTORY, 4, 'v1.0.1')).toBe(HISTORY);
    expect(() => setGitTag(HISTORY, 1, 'x')).toThrow(/command 1 makes no commit/);
    expect(() => setGitTag(HISTORY, 99, 'x')).toThrow(/command 99/);
  });

  it('the editor has no handles, and edits tags and the title in place', () => {
    const { get } = byKey(HISTORY);
    expect(gitgraphEditor.handle(HISTORY, { trait: get('commit:0')!.data.plotMark, pose: get('commit:0')!.pose })).toBeNull();
    const tag = gitgraphEditor.text!(HISTORY, { edit: 'tag', command: 6 }, 'v2');
    expect(tag.commands[6]).toEqual({ kind: 'merge', branch: 'hotfix', tag: 'v2' });
    expect(gitgraphEditor.text!(HISTORY, { edit: 'title' }, '').title).toBeUndefined();
  });
});
