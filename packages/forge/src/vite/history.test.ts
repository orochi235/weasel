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
    const state = { head };
    const git: Git = async (args) => {
      calls.push(args[0]!);
      if (args[0] === 'rev-parse') return args.includes('HEAD') ? `${state.head}\n` : '/nowhere/repo\npkg/forge/\n';
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

  it('answers empty where git fails', async () => {
    const git: Git = async () => {
      throw new Error('not a git repository');
    };
    expect(await createHistoryReader('/nowhere', git).read(['A.tsx'])).toEqual({});
  });
});
