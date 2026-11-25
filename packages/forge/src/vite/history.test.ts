import { describe, expect, it } from 'vitest';
import { createHistoryReader, fileDates, type Git, versionOf } from './history';

const commit = (hash: string, date: string, ...changes: string[]) => [`\0${hash}\t${date}`, '', ...changes].join('\n');

// Newest first, as git prints it.
const LOG = [
  commit('c5', '2026-10-01T10:00:00Z', 'M\tpkg/ui/src/Badge.tsx'),
  commit('c4', '2026-09-01T10:00:00Z', 'A\tpkg/ui/src/Chip.tsx', 'M\tREADME.md'),
  commit('c3', '2026-08-01T10:00:00Z', 'R092\tpkg/weasel-ui/src/Badge.tsx\tpkg/ui/src/Badge.tsx'),
  commit('c2', '2026-07-01T10:00:00Z', 'M\tpkg/weasel-ui/src/Badge.tsx'),
  commit('c1', '2026-06-01T10:00:00Z', 'A\tpkg/weasel-ui/src/Badge.tsx'),
  commit('c0', '2026-05-01T10:00:00Z', 'D\tpkg/weasel-ui/src/Badge.tsx'),
].join('\n');

describe('fileDates', () => {
  it('follows a file back through a rename to the commit that added it', () => {
    expect(fileDates(LOG, ['pkg/ui/src/Badge.tsx']).get('pkg/ui/src/Badge.tsx')).toEqual({
      created: '2026-06-01T10:00:00Z',
      modified: '2026-10-01T10:00:00Z',
      createdBy: 'c1',
      modifiedBy: 'c5',
    });
  });

  it('gives a file committed once the same date twice, and an uncommitted one nothing', () => {
    const dates = fileDates(LOG, ['pkg/ui/src/Chip.tsx', 'pkg/ui/src/New.tsx']);
    expect(dates.get('pkg/ui/src/Chip.tsx')).toEqual({
      created: '2026-09-01T10:00:00Z',
      modified: '2026-09-01T10:00:00Z',
      createdBy: 'c4',
      modifiedBy: 'c4',
    });
    expect(dates.has('pkg/ui/src/New.tsx')).toBe(false);
  });

  it('reads a path git C-quotes, as it does one holding a quote, a backslash, or a control character', () => {
    const log = [
      commit('c2', '2026-02-01T00:00:00Z', 'R100\t"src/a\\"b.tsx"\t"src/t\\tab\\\\c\\001é.tsx"'),
      commit('c1', '2026-01-01T00:00:00Z', 'A\t"src/a\\"b.tsx"'),
    ].join('\n');
    const path = 'src/t\tab\\c\u0001é.tsx';
    expect(fileDates(log, [path]).get(path)).toEqual({
      created: '2026-01-01T00:00:00Z',
      modified: '2026-02-01T00:00:00Z',
      createdBy: 'c1',
      modifiedBy: 'c2',
    });
  });

  it('reads an astral character raw in a C-quoted path', () => {
    const log = commit('c1', '2026-01-01T00:00:00Z', 'A\t"src/\\"x\\" 🎨.tsx"');
    expect(fileDates(log, ['src/"x" 🎨.tsx']).get('src/"x" 🎨.tsx')?.createdBy).toBe('c1');
  });
});

describe('fileDates of a file deleted or renamed away since (found by history.pbt)', () => {
  it('gives nothing to a path whose committed file was deleted, as the file there now is uncommitted', () => {
    const log = [commit('c1', '2026-02-01T00:00:00Z', 'D\ta.ts'), commit('c0', '2026-01-01T00:00:00Z', 'A\ta.ts')].join('\n');
    expect(fileDates(log, ['a.ts']).has('a.ts')).toBe(false);
  });

  it('gives nothing to a path whose committed file was renamed away', () => {
    const log = [
      commit('c2', '2026-03-01T00:00:00Z', 'D\tb.ts'),
      commit('c1', '2026-02-01T00:00:00Z', 'R050\ta.ts\tb.ts'),
      commit('c0', '2026-01-01T00:00:00Z', 'A\ta.ts'),
    ].join('\n');
    expect(fileDates(log, ['a.ts', 'b.ts'])).toEqual(new Map());
  });
});

describe('versionOf', () => {
  it('reads the version off a scoped tag, a v tag and a bare one, past the distance git appends', () => {
    expect(versionOf('@weasel-js/ui@0.5.0~301^2~6\n')).toBe('0.5.0');
    expect(versionOf('v0.4.0~38')).toBe('0.4.0');
    expect(versionOf('2.0.0-beta.1')).toBe('2.0.0-beta.1');
  });

  it('answers null for a commit no release holds, and for a tag that is not a version', () => {
    expect(versionOf('undefined')).toBeNull();
    expect(versionOf('plan-5-complete~2')).toBeNull();
  });
});

describe('createHistoryReader', () => {
  function repo(head = 'h1') {
    const calls: string[] = [];
    const state = { head, tags: [] as string[] };
    const git: Git = async (args) => {
      calls.push(args[0]!);
      if (args[0] === 'rev-parse' && args.includes('HEAD')) return [state.head, ...(args.includes('--tags') ? state.tags : []), ''].join('\n');
      if (args[0] === 'rev-parse') return '/nowhere/repo\npkg/forge/\n';
      if (args[0] === 'log') return LOG;
      if (args[0] === 'name-rev') {
        return args
          .filter((arg) => /^c\d$/.test(arg))
          .map((hash) => ({ c1: 'v0.4.0~3', c5: 'v0.5.0~1' })[hash] ?? 'undefined')
          .join('\n');
      }
      throw new Error(`unexpected git ${args[0]}`);
    };
    return { git, calls, state };
  }

  it('keys each history by the source as the vite root names it, with the release of its first and last change', async () => {
    const { git } = repo();
    const history = await createHistoryReader('/nowhere/repo/pkg/forge', git).read(['../ui/src/Badge.tsx', '../ui/src/Chip.tsx']);
    expect(history).toEqual({
      '../ui/src/Badge.tsx': { created: '2026-06-01T10:00:00Z', modified: '2026-10-01T10:00:00Z', introduced: '0.4.0', modifiedIn: '0.5.0' },
      '../ui/src/Chip.tsx': { created: '2026-09-01T10:00:00Z', modified: '2026-09-01T10:00:00Z', introduced: null, modifiedIn: null },
    });
  });

  it('reads the log again only once HEAD has moved', async () => {
    const { git, calls, state } = repo();
    const reader = createHistoryReader('/nowhere/repo/pkg/forge', git);
    const logs = () => calls.filter((call) => call === 'log').length;
    await reader.read(['../ui/src/Badge.tsx']);
    await reader.read(['../ui/src/Badge.tsx']);
    expect(logs()).toBe(1);
    state.head = 'h2';
    await reader.read(['../ui/src/Badge.tsx']);
    expect(logs()).toBe(2);
  });

  it('reads again once a tag is added, as a release tags a commit already read', async () => {
    const { git, calls, state } = repo();
    const reader = createHistoryReader('/nowhere/repo/pkg/forge', git);
    await reader.read(['../ui/src/Badge.tsx']);
    state.tags.push('t1');
    await reader.read(['../ui/src/Badge.tsx']);
    expect(calls.filter((call) => call === 'log')).toHaveLength(2);
  });

  it('answers empty where git fails', async () => {
    const git: Git = async () => {
      throw new Error('not a git repository');
    };
    expect(await createHistoryReader('/nowhere', git).read(['A.tsx'])).toEqual({});
  });

  it('names the commits of a large package in batches, each command line short enough for Windows', async () => {
    const files = Array.from({ length: 700 }, (_, i) => `pkg/ui/src/C${i}.tsx`);
    const hash = (i: number) => i.toString(16).padStart(40, '0');
    const log = files.map((file, i) => commit(hash(i), '2026-01-01T00:00:00Z', `A\t${file}`)).reverse().join('\n');
    const lengths: number[] = [];
    const git: Git = async (args) => {
      if (args[0] === 'rev-parse') return args.includes('HEAD') ? 'h1\n' : '/nowhere/repo\n\n';
      if (args[0] === 'log') return log;
      lengths.push(args.join(' ').length);
      return args.filter((arg) => /^[0-9a-f]{40}$/.test(arg)).map((sha) => (sha === hash(699) ? 'v2.0.0' : 'undefined')).join('\n');
    };
    const history = await createHistoryReader('/nowhere/repo', git).read(files);
    expect(Object.keys(history)).toHaveLength(700);
    expect(history['pkg/ui/src/C699.tsx']?.introduced).toBe('2.0.0');
    expect(history['pkg/ui/src/C0.tsx']?.introduced).toBeNull();
    expect(Math.max(...lengths)).toBeLessThan(32_767);
  });
});
