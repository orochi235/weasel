import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FleetFailReporter, { failLine } from '../vitest-fleet-fail.mjs';
import FirstFailedSequencer from '../vitest-first-sequencer.mjs';
import { failedFileOf, firstFor, firstInTree, recordFailed } from './fleet-first.mjs';
import { MARKER } from './fleet-tree.mjs';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A git repository with `branches`, each pointing at one empty commit. */
const repo = (branches: string[]) => {
  const root = mkdtempSync(join(tmpdir(), 'fleet-first-'));
  dirs.push(root);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
  for (const b of branches) git('branch', b);
  return root;
};

/** A tree whose marker lists `first`. */
const treeWith = (first: string[]) => {
  const root = mkdtempSync(join(tmpdir(), 'fleet-first-tree-'));
  dirs.push(root);
  mkdirSync(join(root, '.onto'), { recursive: true });
  writeFileSync(join(root, MARKER), JSON.stringify({ commit: 'c', first }));
  return root;
};

describe('the files a branch ran first', () => {
  it('reads the test file from a fleet-fail line, but not a gate step or another line', () => {
    expect(failedFileOf(failLine('weasel-ui', 'packages/a.test.ts', 'A > b'))).toBe('packages/a.test.ts');
    expect(failedFileOf(failLine('browser (chromium)', 'apps/x.browser.test.tsx'))).toBe('apps/x.browser.test.tsx');
    expect(failedFileOf(failLine('gate', 'scripts/ci-checks.gate.ts', 'npm run check:size'))).toBeUndefined();
    expect(failedFileOf('fleet-abort: packages/a.test.ts failed again')).toBeUndefined();
  });

  it("keeps a branch's failed files until a passing run clears them, and drops branches that are gone", () => {
    const root = repo(['batch/a', 'batch/b']);
    recordFailed(root, 'batch/a', ['b.test.ts', 'a.test.ts', 'a.test.ts']);
    recordFailed(root, 'batch/b', ['c.test.ts']);
    expect(firstFor(root, 'batch/a')).toEqual(['a.test.ts', 'b.test.ts']);
    recordFailed(root, 'batch/a', []);
    expect(firstFor(root, 'batch/a')).toEqual([]);
    execFileSync('git', ['branch', '-D', 'batch/b'], { cwd: root, stdio: 'ignore' });
    recordFailed(root, 'batch/a', ['a.test.ts']);
    expect(firstFor(root, 'batch/b')).toEqual([]);
  });

  it("reads the marker's list on a node, and none where there is no marker", () => {
    expect(firstInTree(treeWith(['a.test.ts']))).toEqual(['a.test.ts']);
    expect(firstInTree(mkdtempSync(join(tmpdir(), 'no-marker-')))).toEqual([]);
  });

  it('sorts the files that failed last run ahead of the rest', async () => {
    const root = treeWith(['b.test.ts']);
    const spec = (name: string) => ({ moduleId: join(root, name), project: { name: 'core' } });
    const sequencer = new FirstFailedSequencer({ config: { root } } as never);
    vi.spyOn(Object.getPrototypeOf(FirstFailedSequencer.prototype), 'sort').mockImplementation(async (files) => files);
    const sorted = await sequencer.sort([spec('a.test.ts'), spec('b.test.ts'), spec('c.test.ts')] as never);
    expect(sorted.map((s: { moduleId: string }) => s.moduleId.slice(root.length + 1))).toEqual(['b.test.ts', 'a.test.ts', 'c.test.ts']);
  });

  it('cancels the run once, when a file that failed last run fails again, and not for another file', () => {
    const root = treeWith(['b.test.ts']);
    const cancel = vi.fn(async () => {});
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const reporter = new FleetFailReporter();
      reporter.onInit({ config: { root }, cancelCurrentRun: cancel } as never);
      const failing = (name: string) => ({
        result: () => ({ state: 'failed' }), fullName: 'x', project: { name: 'core' }, module: { moduleId: join(root, name) },
      });
      reporter.onTestCaseResult(failing('a.test.ts') as never);
      expect(cancel).not.toHaveBeenCalled();
      reporter.onTestCaseResult(failing('b.test.ts') as never);
      reporter.onTestCaseResult(failing('b.test.ts') as never);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(write.mock.calls.some(([s]) => String(s).includes('fleet-abort: b.test.ts failed again'))).toBe(true);
    } finally {
      write.mockRestore();
    }
  });
});
