import { execFile } from 'node:child_process';
import { posix, resolve } from 'node:path';
import { packageNameOf } from './packageName.ts';
import { setOwn } from './ownKeys.ts';
import type { ComponentHistory } from '../story/types.ts';

/** Runs git in `cwd` and answers its stdout. */
export type Git = (args: readonly string[], cwd: string) => Promise<string>;

export const runGit: Git = (args, cwd) =>
  new Promise((done, fail) => {
    execFile('git', ['-c', 'core.quotepath=off', ...args], { cwd, maxBuffer: 1 << 30 }, (error, stdout) =>
      error ? fail(error) : done(stdout),
    );
  });

/** A commit header in the log `fileDates` reads: a NUL, the hash, a tab, the author date. */
const LOG_FORMAT = '--format=%x00%H%x09%aI';

const ESCAPES = new Map(Object.entries({ a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 }));

/** A path as git writes it in a log: C-quoted when it holds a quote, a backslash, or a control character. */
function unquoted(name: string): string {
  if (!(name.length > 1 && name.startsWith('"') && name.endsWith('"'))) return name;
  const bytes: number[] = [];
  const body = name.slice(1, -1);
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch !== '\\') {
      bytes.push(...Buffer.from(ch, 'utf8'));
      continue;
    }
    const octal = /^[0-7]{3}/.exec(body.slice(i + 1))?.[0];
    if (octal) {
      bytes.push(parseInt(octal, 8));
      i += 3;
    } else {
      bytes.push(ESCAPES.get(body[i + 1] ?? '') ?? body.charCodeAt(i + 1));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

interface FileDates {
  created: string;
  modified: string;
  /** The commit that added the file. */
  createdBy: string;
  /** The commit that last changed it. */
  modifiedBy: string;
}

/**
 * When each of `paths` was added and last changed, from one `git log --name-status -M` read newest first. A file is
 * followed back through its renames, so one that moved keeps the date it was first written.
 */
export function fileDates(log: string, paths: readonly string[]): Map<string, FileDates> {
  const out = new Map<string, FileDates>();
  /** The name each still-followed file goes by at the commit being read. */
  const names = new Map(paths.map((path) => [path, path]));
  let commit = '';
  let date = '';
  for (const line of log.split('\n')) {
    if (names.size === 0) break;
    if (line.startsWith('\0')) {
      [commit = '', date = ''] = line.slice(1).split('\t');
      continue;
    }
    const [status, ...files] = line.split('\t').map((field, i) => (i === 0 ? field : unquoted(field)));
    const name = files.at(-1);
    const path = name === undefined ? undefined : names.get(name);
    const renamed = status?.startsWith('R') ? files[0] : undefined;
    // Deleted or renamed away since: the file at that name now is uncommitted, not one this history wrote.
    if (status === 'D' && name !== undefined) names.delete(name);
    if (renamed !== undefined) names.delete(renamed);
    if (!status || status === 'D' || name === undefined || path === undefined) continue;
    const newer = out.get(path);
    out.set(path, {
      created: date,
      modified: newer?.modified ?? date,
      createdBy: commit,
      modifiedBy: newer?.modifiedBy ?? commit,
    });
    if (status === 'A' || renamed !== undefined) names.delete(name);
    if (renamed !== undefined) names.set(renamed, path);
  }
  return out;
}

/** The version in a `git name-rev` answer such as `@scope/pkg@1.2.0~3^2`; null when it names no release. */
export function versionOf(named: string): string | null {
  const tag = named.trim().split(/[~^]/)[0] ?? '';
  return /(?:^v?|@)(\d+\.\d+\.\d+[-+.\w]*)$/.exec(tag)?.[1] ?? null;
}

/** How many commits one `git name-rev` names, keeping its command line under Windows' 32,767 characters. */
const NAME_REV_BATCH = 500;

export interface HistoryReader {
  /** The history of each of `sources`, paths relative to the vite root. A file git has never committed has none. */
  read(sources: readonly string[]): Promise<Record<string, ComponentHistory>>;
}

/**
 * Reads component history from git, once per `HEAD` and set of tags: every date comes from a commit and every version
 * from a tag, so nothing changes until one of those does. Outside a repository, or with no git to run, every read
 * answers empty.
 */
export function createHistoryReader(root: string, git: Git = runGit): HistoryReader {
  let cached: { refs: string; sources: string; history: Record<string, ComponentHistory> } | null = null;

  async function load(sources: readonly string[]): Promise<Record<string, ComponentHistory>> {
    const [top = '', prefix = ''] = (await git(['rev-parse', '--show-toplevel', '--show-prefix'], root)).split('\n');
    const inRepo = new Map(sources.map((source) => [posix.normalize(posix.join(prefix, source)), source]));
    const log = await git(['log', '--name-status', '-M', LOG_FORMAT], top);
    const dates = fileDates(log, [...inRepo.keys()]);

    /** Per package, the files it holds: a release is looked for among that package's tags and the unscoped ones. */
    const byPackage = new Map<string | null, string[]>();
    for (const path of dates.keys()) {
      const name = packageNameOf(resolve(top, path), top);
      byPackage.set(name, [...(byPackage.get(name) ?? []), path]);
    }
    const history: Record<string, ComponentHistory> = {};
    for (const [name, paths] of byPackage) {
      const refs = ['v[0-9]*', '[0-9]*', ...(name === null ? [] : [`${name}@[0-9]*`])].map((ref) => `--refs=${ref}`);
      const commits = [...new Set(paths.flatMap((path) => [dates.get(path)!.createdBy, dates.get(path)!.modifiedBy]))];
      const named = new Map<string, string>();
      for (let at = 0; at < commits.length; at += NAME_REV_BATCH) {
        const batch = commits.slice(at, at + NAME_REV_BATCH);
        const names = (await git(['name-rev', '--tags', '--name-only', ...refs, ...batch], top)).split('\n');
        batch.forEach((commit, i) => named.set(commit, names[i] ?? ''));
      }
      for (const path of paths) {
        const { created, modified, createdBy, modifiedBy } = dates.get(path)!;
        setOwn(history, inRepo.get(path)!, {
          created,
          modified,
          introduced: versionOf(named.get(createdBy) ?? ''),
          modifiedIn: versionOf(named.get(modifiedBy) ?? ''),
        });
      }
    }
    return history;
  }

  return {
    async read(sources) {
      try {
        // HEAD and every tag: a release tagged onto a commit already read changes no date but does change a version.
        const refs = (await git(['rev-parse', 'HEAD', '--tags'], root)).trim();
        const key = [...sources].sort().join('\n');
        if (cached?.refs !== refs || cached.sources !== key) cached = { refs, sources: key, history: await load(sources) };
        return cached.history;
      } catch {
        return {};
      }
    },
  };
}
