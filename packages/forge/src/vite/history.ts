import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
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
    const [status, ...files] = line.split('\t');
    const name = files.at(-1);
    const path = name === undefined ? undefined : names.get(name);
    if (!status || name === undefined || path === undefined) continue;
    const newer = out.get(path);
    out.set(path, {
      created: date,
      modified: newer?.modified ?? date,
      createdBy: commit,
      modifiedBy: newer?.modifiedBy ?? commit,
    });
    const renamed = status.startsWith('R') ? files[0] : undefined;
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

/** The name of the package `file` belongs to: the nearest `package.json` at or under `top` that has one. */
function packageOf(file: string, top: string): string | null {
  for (let dir = dirname(file); dir.startsWith(top); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const name = (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name;
        if (typeof name === 'string') return name;
      } catch {
        // An unreadable manifest names no package; the next one up may.
      }
    }
    if (dir === top) break;
  }
  return null;
}

export interface HistoryReader {
  /** The history of each of `sources`, paths relative to the vite root. A file git has never committed has none. */
  read(sources: readonly string[]): Promise<Record<string, ComponentHistory>>;
}

/**
 * Reads component history from git, once per `HEAD`: every date comes from a commit, so nothing changes until one
 * lands. Outside a repository, or with no git to run, every read answers empty.
 */
export function createHistoryReader(root: string, git: Git = runGit): HistoryReader {
  let cached: { head: string; sources: string; history: Record<string, ComponentHistory> } | null = null;

  async function load(sources: readonly string[]): Promise<Record<string, ComponentHistory>> {
    const [top = '', prefix = ''] = (await git(['rev-parse', '--show-toplevel', '--show-prefix'], root)).split('\n');
    const inRepo = new Map(sources.map((source) => [posix.normalize(posix.join(prefix, source)), source]));
    const log = await git(['log', '--name-status', '-M', LOG_FORMAT], top);
    const dates = fileDates(log, [...inRepo.keys()]);

    /** Per package, the files it holds: a release is looked for among that package's tags and the unscoped ones. */
    const byPackage = new Map<string | null, string[]>();
    for (const path of dates.keys()) {
      const name = packageOf(resolve(top, path), top);
      byPackage.set(name, [...(byPackage.get(name) ?? []), path]);
    }
    const history: Record<string, ComponentHistory> = {};
    for (const [name, paths] of byPackage) {
      const refs = ['v[0-9]*', '[0-9]*', ...(name === null ? [] : [`${name}@[0-9]*`])].map((ref) => `--refs=${ref}`);
      const commits = paths.flatMap((path) => [dates.get(path)!.createdBy, dates.get(path)!.modifiedBy]);
      const named = (await git(['name-rev', '--tags', '--name-only', ...refs, ...commits], top)).split('\n');
      paths.forEach((path, i) => {
        const { created, modified } = dates.get(path)!;
        history[inRepo.get(path)!] = {
          created,
          modified,
          introduced: versionOf(named[2 * i] ?? ''),
          modifiedIn: versionOf(named[2 * i + 1] ?? ''),
        };
      });
    }
    return history;
  }

  return {
    async read(sources) {
      try {
        const head = (await git(['rev-parse', 'HEAD'], root)).trim();
        const key = [...sources].sort().join('\n');
        if (cached?.head !== head || cached.sources !== key) cached = { head, sources: key, history: await load(sources) };
        return cached.history;
      } catch {
        return {};
      }
    },
  };
}
