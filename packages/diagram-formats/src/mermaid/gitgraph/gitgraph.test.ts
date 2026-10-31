import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GitGraphData } from '@weasel-js/plot';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidGitGraph } from './read';
import { writeMermaidGitGraph } from './write';

const FIXTURES = ['release.mmd', 'vertical.mmd'];
const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'gitgraph', name), 'utf8');
const plotOf = (text: string) => readMermaidGitGraph(text).document.pages[0] as PlotPage;
const pageOf = (data: GitGraphData): PlotPage => ({ kind: 'plot', id: 'p', width: 10, height: 10, data });

describe('reading a Mermaid gitGraph', () => {
  it('reads each statement as a command onto one plot page, titled by the front matter', () => {
    const { document, warnings } = readMermaidGitGraph(fixture('release.mmd'));
    const page = document.pages[0] as PlotPage;
    expect(page).toMatchObject({ kind: 'plot', id: 'page-1', name: 'Release flow', width: 900, height: 420 });
    expect(page.data).toEqual({
      kind: 'gitgraph',
      title: 'Release flow',
      commands: [
        { kind: 'commit', id: 'ZERO' },
        { kind: 'branch', name: 'develop', order: 2 },
        { kind: 'commit', id: 'A', message: 'start develop' },
        { kind: 'branch', name: 'feature', order: 3 },
        { kind: 'commit', type: 'HIGHLIGHT' },
        { kind: 'commit' },
        { kind: 'checkout', name: 'develop' },
        { kind: 'commit', type: 'REVERSE', tag: 'revert-1' },
        { kind: 'checkout', name: 'main' },
        { kind: 'branch', name: 'hotfix', order: 1 },
        { kind: 'commit', id: 'FIX' },
        { kind: 'checkout', name: 'main' },
        { kind: 'merge', branch: 'hotfix', tag: 'v1.0.1' },
        { kind: 'checkout', name: 'develop' },
        { kind: 'merge', branch: 'feature', id: 'M1', type: 'HIGHLIGHT' },
        { kind: 'cherry-pick', id: 'FIX', tag: 'picked' },
        { kind: 'checkout', name: 'main' },
        { kind: 'merge', branch: 'develop', tag: 'v2.0' },
      ],
    });
    expect(warnings).toEqual(['Commit messages are kept but not drawn.']);
  });

  it('reads the run direction, quoted branch names, and a merge cherry-picked with its parent', () => {
    const data = plotOf(fixture('vertical.mmd')).data as GitGraphData;
    expect(data.orientation).toBe('TB');
    expect(data.commands[6]).toEqual({ kind: 'branch', name: 'release x' });
    expect(data.commands[9]).toEqual({ kind: 'cherry-pick', id: 'm', parent: 'c' });
    expect((plotOf('gitGraph BT:\n  commit').data as GitGraphData).orientation).toBe('BT');
    expect((plotOf('gitGraph:\n  commit').data as GitGraphData).orientation).toBeUndefined();
  });

  it('warns on what it drops', () => {
    expect(readMermaidGitGraph('%%{init: {\'gitGraph\': {\'mainBranchName\': \'trunk\'}}}%%\ngitGraph\n  commit').warnings)
      .toEqual(['Mermaid configuration directives were dropped.']);
  });

  it('throws, naming the line, on what it cannot read', () => {
    const fails = (body: string) => () => readMermaidGitGraph(`gitGraph\n${body}`);
    expect(fails('  commit\n  checkout dev')).toThrow('Mermaid, line 3: cannot check out "dev": there is no such branch; create it with "branch dev"');
    expect(fails('  commit\n  branch main')).toThrow('Mermaid, line 3: a branch "main" already exists; check it out instead');
    expect(fails('  commit\n\n  merge main')).toThrow('Mermaid, line 4: "main" cannot be merged into itself');
    expect(fails('  branch b\n  checkout main\n  commit\n  merge b')).toThrow('Mermaid, line 5: cannot merge "b": it has no commits');
    expect(fails('  commit id: "x"\n  cherry-pick id: "x"')).toThrow('Mermaid, line 3: cannot cherry-pick "x": it is already on "main"');
    expect(fails('  cherry-pick id: "x"')).toThrow('Mermaid, line 2: cannot cherry-pick "x": there is no such commit');
    expect(fails('  cherry-pick tag: "x"')).toThrow('Mermaid, line 2: cherry-pick needs the id of the commit it copies');
    expect(fails('  commit kind: x')).toThrow(/line 2: "kind" is not an attribute of commit/);
    expect(fails('  commit type: BIG')).toThrow(/line 2: "BIG" is not a commit type/);
    expect(fails('  commit id: "a" id: "b"')).toThrow('Mermaid, line 2: "id" is given twice');
    expect(fails('  branch b order: first')).toThrow(/line 2: "first" is not an order/);
    expect(fails('  rebase main')).toThrow('Mermaid, line 2: "rebase" is not a gitGraph statement');
    expect(() => readMermaidGitGraph('gitGraph RL:')).toThrow(/line 1: "gitGraph RL:" is not a gitGraph header/);
  });
});

describe('writing a Mermaid gitGraph', () => {
  it('round-trips each fixture', () => {
    for (const name of FIXTURES) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidGitGraph(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes plainly, quoting what needs it', () => {
    expect(writeMermaidGitGraph(plotOf(fixture('vertical.mmd'))).text).toBe([
      'gitGraph TB:',
      '  commit id: "a"',
      '  branch side',
      '  commit id: "b"',
      '  checkout main',
      '  commit id: "c"',
      '  merge side id: "m"',
      '  branch "release x"',
      '  commit',
      '  cherry-pick id: "b"',
      '  cherry-pick id: "m" parent: "c"',
      '',
    ].join('\n'));
    expect(writeMermaidGitGraph(plotOf(fixture('release.mmd'))).text).toMatch(/^---\ntitle: "Release flow"\n---\ngitGraph\n {2}commit id: "ZERO"\n {2}branch develop order: 2\n {2}commit id: "A" msg: "start develop"\n/);
  });

  it('warns on what Mermaid cannot hold', () => {
    const trunk: GitGraphData = {
      kind: 'gitgraph', mainBranch: 'trunk',
      commands: [{ kind: 'commit', tag: 'say "hi"' }, { kind: 'branch', name: 'b' }, { kind: 'checkout', name: 'trunk' }],
    };
    const { text, warnings } = writeMermaidGitGraph(pageOf(trunk));
    expect(text).toBe('gitGraph\n  commit tag: "say \'hi\'"\n  branch b\n  checkout main\n');
    expect(warnings).toEqual([
      'Mermaid\'s main branch is "main"; "trunk" was written as main.',
      'Mermaid strings hold no double quotes; they were written as single quotes.',
    ]);
    expect(() => writeMermaidGitGraph(pageOf({ ...trunk, commands: [{ kind: 'branch', name: 'main' }] }))).toThrow(/another branch by that name/);
    expect(() => writeMermaidGitGraph({ ...pageOf(trunk), data: { kind: 'pie', slices: [] } as never })).toThrow(/as a gitGraph only/);
  });
});

describe('the Mermaid format', () => {
  it('reads a gitGraph by its header and writes a plot page as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('vertical.mmd'));
    expect((document.pages[0] as PlotPage).data.kind).toBe('gitgraph');
    expect(DIAGRAM_MERMAID.detect(fixture('release.mmd'))).toBe(true);
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('gitGraph TB:\n')).toBe(true);
    expect(((await DIAGRAM_MERMAID.read!('gitGraph LR:\n  commit')).document.pages[0] as PlotPage).data.kind).toBe('gitgraph');
  });
});
