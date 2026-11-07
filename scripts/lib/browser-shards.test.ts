import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { balancedSlices, browserProcesses, browserShards, DURATIONS_ENV, durationsEnv, recordedDurations } from './browser-shards.mjs';

describe('browserProcesses', () => {
  it('splits on the node sizes it was measured on, and keeps one process below them', () => {
    expect([4, 8, 10, 14, 18].map(browserProcesses)).toEqual([1, 1, 3, 3, 3]);
  });
});

describe('browserShards', () => {
  it('gives each process its own slice of the files', () => {
    expect(browserShards(['run', '--project=browser'], 3)).toEqual([
      ['run', '--project=browser', '--passWithNoTests', '--shard=1/3'],
      ['run', '--project=browser', '--passWithNoTests', '--shard=2/3'],
      ['run', '--project=browser', '--passWithNoTests', '--shard=3/3'],
    ]);
  });

  it('keeps one process when asked for one', () => {
    expect(browserShards(['run', '--project=browser'], 1)).toEqual([['run', '--project=browser']]);
  });

  it('keeps one process when the caller already runs a slice, which a second split cannot divide', () => {
    expect(browserShards(['run', '--project=browser', '--shard=2/4'], 3)).toEqual([['run', '--project=browser', '--shard=2/4']]);
  });

  it('does not repeat --passWithNoTests', () => {
    expect(browserShards(['run', '--passWithNoTests'], 2)[0]).toEqual(['run', '--passWithNoTests', '--shard=1/2']);
  });
});

describe('balancedSlices', () => {
  const ids = (slices: { ids: string[] }[]) => slices.map((s) => s.ids);

  it('puts the longest files first, each into the slice holding least', () => {
    const slices = balancedSlices(['a', 'b', 'c', 'd', 'e'], { a: 50, b: 40, c: 30, d: 20, e: 10 }, 3);
    expect(ids(slices)).toEqual([['a'], ['b', 'e'], ['c', 'd']]);
    expect(slices.map((s) => s.ms)).toEqual([50, 50, 50]);
  });

  it('gives every file to exactly one slice, whatever order the ids arrive in', () => {
    const files = Array.from({ length: 40 }, (_, i) => `f${i}`);
    const durations = Object.fromEntries(files.map((f, i) => [f, (i * 37) % 11]));
    const a = balancedSlices(files, durations, 3);
    const b = balancedSlices([...files].reverse(), durations, 3);
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a).flat().sort()).toEqual([...files].sort());
  });

  it('weighs a file with no usable record as the median of those with one', () => {
    const slices = balancedSlices(['a', 'b', 'c', 'new', 'bad'], { a: 30, b: 10, c: 20, bad: -1 }, 2);
    expect(slices.map((s) => s.ms).reduce((x, y) => x + y)).toBe(30 + 10 + 20 + 20 + 20);
    expect(ids(slices).flat().sort()).toEqual(['a', 'b', 'bad', 'c', 'new']);
  });

  it('splits by count when nothing is recorded', () => {
    expect(ids(balancedSlices(['c', 'a', 'b', 'd'], {}, 2))).toEqual([['a', 'c'], ['b', 'd']]);
  });

  it('leaves a slice empty when there are fewer files than slices', () => {
    expect(ids(balancedSlices(['a'], { a: 5 }, 3))).toEqual([['a'], [], []]);
  });
});

describe('recordedDurations', () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });
  const cache = (hash: string, body: string) => {
    root ??= mkdtempSync(join(tmpdir(), 'browser-shards-'));
    const dir = join(root, 'node_modules/.vite/vitest', hash);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'results.json'), body);
  };
  const results = (files: Record<string, unknown>, project = 'browser') => JSON.stringify({ version: 1, projects: { [project]: { files } } });

  it('reads each file of the project, keeping the newest record across caches', () => {
    cache('one', results({ 'a.browser.test.ts': { duration: 100.4, lastRun: 1 }, 'b.browser.test.ts': { duration: 7, lastRun: 5 } }));
    cache('two', results({ 'a.browser.test.ts': { duration: 300, lastRun: 2 }, 'b.browser.test.ts': { duration: 9, lastRun: 4 } }));
    expect(recordedDurations(root!)).toEqual({ 'a.browser.test.ts': 300, 'b.browser.test.ts': 7 });
  });

  it('skips what it cannot use: no cache, a torn file, another version, another project, a bad duration', () => {
    expect(recordedDurations(join(tmpdir(), 'no-such-root-browser-shards'))).toEqual({});
    cache('torn', '{"version":1,"proj');
    cache('old', JSON.stringify({ version: '5.0.2', results: [['browser:a.ts', { duration: 1 }]] }));
    cache('other', results({ 'a.test.ts': { duration: 1 } }, 'core'));
    cache('bad', results({ 'x.ts': { duration: 'slow' }, 'y.ts': null, 'z.ts': { duration: 4 } }));
    expect(recordedDurations(root!)).toEqual({ 'z.ts': 4 });
  });

  it('passes the snapshot keyed by project, and passes none when the split is by hash', () => {
    cache('one', results({ 'a.ts': { duration: 2 } }));
    expect(durationsEnv(root!, {})).toEqual({ [DURATIONS_ENV]: JSON.stringify({ 'browser:a.ts': 2 }) });
    expect(durationsEnv(root!, { WEASEL_SHARD_SPLIT: 'hash' })).toEqual({});
  });
});
