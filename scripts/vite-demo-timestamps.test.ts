import { execSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { demoTimestamps, timestampsFromLog } from './vite-demo-timestamps.ts';

const root = resolve(import.meta.dirname, '..');
const RESOLVED_ID = '\0virtual:demo-timestamps';

function plugin() {
  const p = demoTimestamps({ root }) as Plugin;
  const call = (hook: unknown, ...args: unknown[]) => (hook as (...a: unknown[]) => unknown).call({}, ...args);
  return {
    buildStart: () => call(p.buildStart),
    load: () => call(p.load, RESOLVED_ID) as Promise<string>,
  };
}

const loaded = async (code: Promise<string>) => JSON.parse((await code).replace(/^export default |;$/g, ''));

describe('demoTimestamps', () => {
  // A `git` ahead of the real one on PATH, counting each spawn before handing over.
  let shim: string;
  let path: string | undefined;
  const spawns = () => readFileSync(join(shim, 'spawns'), 'utf8').length;
  beforeEach(() => {
    shim = mkdtempSync(join(tmpdir(), 'demo-timestamps-'));
    const git = execSync('command -v git', { encoding: 'utf8' }).trim();
    writeFileSync(join(shim, 'spawns'), '');
    writeFileSync(join(shim, 'git'), `#!/bin/sh\nprintf x >> '${join(shim, 'spawns')}'\nexec '${git}' "$@"\n`);
    chmodSync(join(shim, 'git'), 0o755);
    path = process.env.PATH;
    process.env.PATH = `${shim}${delimiter}${path}`;
  });
  afterEach(() => {
    process.env.PATH = path;
    rmSync(shim, { recursive: true, force: true });
  });

  it('dates the real demos as the synchronous log of the same pass did', async () => {
    const log = execSync('git log -M --cc --name-status --format=%x00%aI -- apps/site/demos demo', {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
    const files = readdirSync(resolve(root, 'apps/site/demos'), { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.tsx?$/.test(f))
      .map((f) => `apps/site/demos/${f.replace(/\\/g, '/')}`);
    const expected = timestampsFromLog(log, files);
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(await loaded(plugin().load())).toEqual(expected);
  });

  it('runs git once per build, however many loads await it', async () => {
    const p = plugin();
    p.buildStart();
    const [a, b] = await Promise.all([p.load(), p.load()]);
    expect(await p.load()).toBe(a);
    expect(b).toBe(a);
    expect(spawns()).toBe(1);
  });

  it('starts the log on first load when no build started it', async () => {
    const p = plugin();
    await Promise.all([p.load(), p.load()]);
    expect(spawns()).toBe(1);
  });
});

/** `git log --name-status --format=%x00%aI` text, commits newest first. */
const log = (...commits: [date: string, ...entries: string[]][]) =>
  commits.map(([date, ...entries]) => `\0${date}\n\n${entries.join('\n')}\n`).join('');

describe('timestampsFromLog', () => {
  it('takes the newest commit touching a file and the oldest one adding it', () => {
    const text = log(['2026-03-01', 'M\tdemos/a.tsx'], ['2026-02-01', 'M\tdemos/a.tsx'], ['2026-01-01', 'A\tdemos/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])).toEqual({
      'demos/a.tsx': { created: '2026-01-01', lastModified: '2026-03-01' },
    });
  });

  it('follows a rename back to the add of the old name', () => {
    const text = log(['2026-03-01', 'R100\tdemo/a.tsx\tdemos/a.tsx'], ['2026-01-01', 'A\tdemo/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])).toEqual({
      'demos/a.tsx': { created: '2026-01-01', lastModified: '2026-03-01' },
    });
  });

  it('dates the last change by the current name only, as a log of that path would', () => {
    const text = log(['2026-03-01', 'R090\tdemo/a.tsx\tdemos/a.tsx'], ['2026-02-01', 'M\tdemo/a.tsx'], ['2026-01-01', 'A\tdemo/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])['demos/a.tsx'].lastModified).toBe('2026-03-01');
  });

  it('counts a merge that changed the file, whose combined status is two letters', () => {
    const text = log(['2026-03-01', 'MM\tdemos/a.tsx'], ['2026-01-01', 'A\tdemos/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])['demos/a.tsx'].lastModified).toBe('2026-03-01');
  });

  it('keeps the oldest add of a file deleted and added again', () => {
    const text = log(['2026-03-01', 'A\tdemos/a.tsx'], ['2026-01-01', 'A\tdemos/a.tsx']);
    expect(timestampsFromLog(text, ['demos/a.tsx'])['demos/a.tsx'].created).toBe('2026-01-01');
  });

  it('leaves out a file no commit names', () => {
    expect(timestampsFromLog(log(['2026-01-01', 'A\tdemos/a.tsx']), ['demos/new.tsx'])).toEqual({});
  });
});
