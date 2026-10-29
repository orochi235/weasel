import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COMMIT_ENV,
  MARKER,
  ONTO_STAMP,
  armTree,
  blobHash,
  branchChanges,
  changedFiles,
  checkTree,
  fleetBranch,
  selection,
  stampReport,
  stepEnv,
  treeReport,
  treeStamp,
} from './fleet-tree.mjs';

const COMMIT = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const ZERO = '0'.repeat(40);

let root: string;
const put = (path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const mark = (commit: string, files: Record<string, string | null>) => put(MARKER, JSON.stringify({ commit, files }));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fleet-tree-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('blobHash', () => {
  it('is the id git gives the same bytes', () => {
    expect(blobHash(Buffer.from('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
});

describe('changedFiles', () => {
  const entry = (oldMode: string, newMode: string, oldId: string, newId: string, status: string, path: string) =>
    `:${oldMode} ${newMode} ${oldId} ${newId} ${status}\0${path}\0`;

  it('maps an added or modified file to its blob and a deleted one to null', () => {
    const raw =
      entry('000000', '100644', ZERO, '1'.repeat(40), 'A', 'src/added.ts') +
      entry('100644', '100755', '2'.repeat(40), '3'.repeat(40), 'M', 'bin/tool') +
      entry('100644', '000000', '4'.repeat(40), ZERO, 'D', 'src/scene.carry.test.ts');
    expect(changedFiles(raw)).toEqual({
      'src/added.ts': '1'.repeat(40),
      'bin/tool': '3'.repeat(40),
      'src/scene.carry.test.ts': null,
    });
  });

  it('leaves out a symlink, a submodule, and the plan the run rewrites', () => {
    const raw =
      entry('000000', '120000', ZERO, '1'.repeat(40), 'A', 'link') +
      entry('000000', '160000', ZERO, '2'.repeat(40), 'A', 'vendored') +
      entry('100644', '100644', '3'.repeat(40), '4'.repeat(40), 'M', '.onto/tests');
    expect(changedFiles(raw)).toEqual({});
  });
});

describe('checkTree', () => {
  it('is not armed with no marker and no commit named', () => {
    put('src/a.ts', 'a\n');
    expect(checkTree(root, {})).toEqual({ armed: false, commit: undefined, checked: 0, problems: [] });
  });

  it('passes a tree that holds what the marker lists', () => {
    put('src/a.ts', 'a\n');
    mark(COMMIT, { 'src/a.ts': blobHash(Buffer.from('a\n')), 'src/gone.ts': null });
    expect(checkTree(root, { [COMMIT_ENV]: COMMIT })).toEqual({ armed: true, commit: COMMIT, checked: 2, problems: [] });
  });

  it('fails the base tree: a file the commit deletes is still there', () => {
    put('src/scene.carry.test.ts', 'old\n');
    mark(COMMIT, { 'src/scene.carry.test.ts': null });
    const { problems } = checkTree(root, { [COMMIT_ENV]: COMMIT });
    expect(problems).toEqual(['src/scene.carry.test.ts exists, and the commit deletes it']);
  });

  it('fails the base tree: a file the commit adds is missing', () => {
    mark(COMMIT, { 'src/added.test.ts': blobHash(Buffer.from('new\n')) });
    const { problems } = checkTree(root, { [COMMIT_ENV]: COMMIT });
    expect(problems).toEqual(['src/added.test.ts is missing']);
  });

  it('fails a file whose content is not the commit’s', () => {
    put('src/a.ts', 'base\n');
    mark(COMMIT, { 'src/a.ts': blobHash(Buffer.from('changed\n')) });
    const { problems } = checkTree(root, { [COMMIT_ENV]: COMMIT });
    expect(problems).toEqual(['src/a.ts differs from the commit']);
  });

  it('fails when the run names a commit and the tree has no marker', () => {
    const { armed, problems } = checkTree(root, { [COMMIT_ENV]: COMMIT });
    expect(armed).toBe(true);
    expect(problems).toEqual([`no ${MARKER}: this tree was not sent by the run that asked for ${COMMIT}`]);
  });

  it('fails when the marker is another run’s, even though that tree agrees with it', () => {
    put('src/a.ts', 'a\n');
    mark(OTHER, { 'src/a.ts': blobHash(Buffer.from('a\n')) });
    const { problems } = checkTree(root, { [COMMIT_ENV]: COMMIT });
    expect(problems).toEqual([`this tree is ${OTHER}, and the run asked for ${COMMIT}`]);
  });

  it('fails a marker when the job names no commit, however well the tree agrees with it', () => {
    put('src/a.ts', 'a\n');
    mark(COMMIT, { 'src/a.ts': blobHash(Buffer.from('a\n')) });
    const { armed, problems } = checkTree(root, {});
    expect(armed).toBe(true);
    expect(problems).toEqual([
      `${MARKER} says ${COMMIT}, and the job named no commit in ${COMMIT_ENV}; a marker alone is whichever run synced last`,
    ]);
  });
});

describe('armTree', () => {
  it('writes the marker and has the plan export the commit to the suite', () => {
    put('.onto/tests', 'plugin: node\nrun: vitest run\n');
    expect(armTree(root, { commit: COMMIT, files: { 'src/a.ts': null } }, { plan: true })).toBe(`${COMMIT_ENV}=${COMMIT}`);
    expect(JSON.parse(readFileSync(join(root, MARKER), 'utf8'))).toEqual({ commit: COMMIT, files: { 'src/a.ts': null } });
    expect(readFileSync(join(root, '.onto/tests'), 'utf8')).toBe(
      `plugin: node\nrun: vitest run\nprelude: export ${COMMIT_ENV}=${COMMIT}\n`,
    );
  });

  it('leaves the plan alone for a job that carries the commit in its own environment', () => {
    put('.onto/tests', 'run: vitest run\n');
    expect(armTree(root, { commit: COMMIT, files: {} })).toBe(`${COMMIT_ENV}=${COMMIT}`);
    expect(readFileSync(join(root, '.onto/tests'), 'utf8')).toBe('run: vitest run\n');
  });
});

/**
 * Two sessions test two commits on one node, whose one tree each sync replaces whole. Each run
 * arms its own local tree, and `onto test` reads that tree's plan here, at launch, so the job
 * carries its commit; the node's copy of the marker and plan is whichever sync came last.
 */
describe('two runs syncing one node tree', () => {
  const PLAN_TEXT = 'plugin: node\nrun: vitest run\n';
  let local: Record<string, string>;
  const arm = (commit: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'fleet-local-'));
    writeFileSync(join(dir, 'a.ts'), `${commit}\n`);
    mkdirSync(join(dir, '.onto'));
    writeFileSync(join(dir, '.onto/tests'), PLAN_TEXT);
    armTree(dir, { commit, files: { 'a.ts': blobHash(Buffer.from(`${commit}\n`)) } }, { plan: true });
    local[commit] = dir;
  };
  const sync = (commit: string) => {
    for (const path of ['a.ts', MARKER, '.onto/tests']) put(path, readFileSync(join(local[commit], path), 'utf8'));
  };
  /** What `onto test` puts in the launch request: the prelude of the plan it reads on this machine. */
  const launch = (commit: string) => {
    const env: Record<string, string> = {};
    for (const [, key, value] of readFileSync(join(local[commit], '.onto/tests'), 'utf8').matchAll(/^prelude: export (\w+)=(\S+)$/gm)) {
      env[key] = value;
    }
    return env;
  };

  beforeEach(() => {
    local = {};
    arm(COMMIT);
    arm(OTHER);
  });
  afterEach(() => {
    for (const dir of Object.values(local)) rmSync(dir, { recursive: true, force: true });
  });

  it('passes the run whose sync the tree still holds', () => {
    sync(COMMIT);
    expect(treeReport(checkTree(root, launch(COMMIT)))).toEqual({ ok: true, text: `fleet-tree: 1 changed path(s) match ${COMMIT}` });
  });

  it('fails the earlier run once a later sync replaces the marker and the plan, naming both commits', () => {
    sync(COMMIT);
    const job = launch(COMMIT);
    sync(OTHER);
    const report = treeReport(checkTree(root, job));
    expect(report.ok).toBe(false);
    expect(report.text).toContain(`this tree is ${OTHER}, and the run asked for ${COMMIT}`);
  });

  it('fails a job that names no commit rather than take the later sync’s marker for its own', () => {
    sync(COMMIT);
    sync(OTHER);
    const report = treeReport(checkTree(root, {}));
    expect(report.ok).toBe(false);
    expect(report.text).toContain(`${MARKER} says ${OTHER}`);
  });
});

describe('selection', () => {
  const marked = (select: string[] | undefined = ['src/a.ts', 'src/gone.ts']) =>
    put(MARKER, JSON.stringify({ commit: COMMIT, files: { 'src/a.ts': '1'.repeat(40), 'src/gone.ts': null, 'src/main.ts': null }, select }));

  const none = { always: [], triggers: [] };

  it('is the changed paths, absolute, plus every path the run always keeps', () => {
    marked();
    expect(selection(root, { [COMMIT_ENV]: COMMIT }, { always: ['scripts/x.gate.ts'], triggers: ['**/package.json'] })).toEqual(
      [join(root, 'src/a.ts'), join(root, 'src/gone.ts'), join(root, 'scripts/x.gate.ts')],
    );
  });

  it('is undefined when a changed path is a trigger', () => {
    marked();
    expect(selection(root, { [COMMIT_ENV]: COMMIT }, { always: [], triggers: ['src/*.ts'] })).toBeUndefined();
  });

  it('selects from its own list, not every path the tree check covers', () => {
    marked(['src/a.ts']);
    expect(selection(root, { [COMMIT_ENV]: COMMIT }, none)).toEqual([join(root, 'src/a.ts')]);
  });

  it('is undefined for a run that tests everything', () => {
    put(MARKER, JSON.stringify({ commit: COMMIT, files: { 'src/a.ts': '1'.repeat(40) } }));
    expect(selection(root, { [COMMIT_ENV]: COMMIT }, none)).toBeUndefined();
  });

  it('is undefined in a step a fleet job spawns, which still carries the commit for the tree check', () => {
    marked();
    put('src/a.ts', 'a\n');
    const env = stepEnv({ [COMMIT_ENV]: COMMIT, PATH: '/bin' });
    expect(env).toMatchObject({ [COMMIT_ENV]: COMMIT, PATH: '/bin' });
    expect(selection(root, env, none)).toBeUndefined();
    expect(checkTree(root, env).problems).toEqual(['src/a.ts differs from the commit']);
  });

  it('is undefined with no marker, and for a marker this run did not ask for', () => {
    expect(selection(root, {}, none)).toBeUndefined();
    marked();
    expect(selection(root, { [COMMIT_ENV]: OTHER }, none)).toBeUndefined();
    expect(selection(root, {}, none)).toBeUndefined();
  });
});

describe('branchChanges', () => {
  const marked = (extra: object) => put(MARKER, JSON.stringify({ commit: COMMIT, files: {}, select: ['src/a.ts', 'src/new.ts'], ...extra }));
  const none = { triggers: [] };

  it('is the changed paths and the ones the branch adds or deletes, relative', () => {
    marked({ reshaped: ['src/new.ts'] });
    expect(branchChanges(root, { [COMMIT_ENV]: COMMIT }, none)).toEqual({ changed: ['src/a.ts', 'src/new.ts'], reshaped: ['src/new.ts'] });
  });

  it('counts every changed path as reshaped for a marker that does not say', () => {
    marked({});
    expect(branchChanges(root, { [COMMIT_ENV]: COMMIT }, none)?.reshaped).toEqual(['src/a.ts', 'src/new.ts']);
  });

  it('is undefined when the run tests everything, as selection is', () => {
    marked({ reshaped: [] });
    expect(branchChanges(root, { [COMMIT_ENV]: COMMIT }, { triggers: ['src/a.ts'] })).toBeUndefined();
    expect(branchChanges(root, { [COMMIT_ENV]: OTHER }, none)).toBeUndefined();
    expect(branchChanges(root, stepEnv({ [COMMIT_ENV]: COMMIT }), none)).toBeUndefined();
  });
});

describe('fleetBranch', () => {
  const marked = (branch?: string) => put(MARKER, JSON.stringify({ commit: COMMIT, branch, files: {} }));

  it("is the marker's branch for the run that asked for it, a step it spawns included", () => {
    marked('feature/x');
    expect(fleetBranch(root, { [COMMIT_ENV]: COMMIT })).toBe('feature/x');
    expect(fleetBranch(root, stepEnv({ [COMMIT_ENV]: COMMIT }))).toBe('feature/x');
  });

  it('is undefined for main, for no branch, and for a marker another run wrote', () => {
    marked('main');
    expect(fleetBranch(root, { [COMMIT_ENV]: COMMIT })).toBeUndefined();
    marked();
    expect(fleetBranch(root, { [COMMIT_ENV]: COMMIT })).toBeUndefined();
    marked('feature/x');
    expect(fleetBranch(root, { [COMMIT_ENV]: OTHER })).toBeUndefined();
    expect(fleetBranch(root, {})).toBeUndefined();
  });
});

describe('treeReport', () => {
  it('prints the line a passing run is known by', () => {
    put('a.ts', 'x');
    mark(COMMIT, { 'a.ts': blobHash(Buffer.from('x')) });
    expect(treeReport(checkTree(root, { [COMMIT_ENV]: COMMIT }))).toEqual({ ok: true, text: `fleet-tree: 1 changed path(s) match ${COMMIT}` });
  });

  it('names what is wrong with the tree', () => {
    mark(COMMIT, { 'a.ts': '1'.repeat(40) });
    const report = treeReport(checkTree(root, { [COMMIT_ENV]: COMMIT }));
    expect(report.ok).toBe(false);
    expect(report.text).toContain('a.ts is missing');
  });
});

describe('treeStamp', () => {
  const stamped = (stamp: string) => put(ONTO_STAMP, JSON.stringify({ stamp, at: '2026-10-21T00:00:00Z' }));

  it('is the same for a tree nothing synced in between', () => {
    stamped('0123456789abcdef');
    mark(COMMIT, { 'a.ts': null });
    expect(treeStamp(root)).toBe(treeStamp(root));
  });

  it('names the stamp onto left', () => {
    stamped('0123456789abcdef');
    expect(treeStamp(root)).toContain('0123456789abcdef');
  });

  it('changes when onto syncs the tree again', () => {
    stamped('0123456789abcdef');
    mark(COMMIT, { 'a.ts': null });
    const before = treeStamp(root);
    stamped('fedcba9876543210');
    expect(treeStamp(root)).not.toBe(before);
  });

  it('changes when a sync replaces or removes the marker, even with no onto stamp', () => {
    mark(COMMIT, { 'a.ts': null });
    const before = treeStamp(root);
    mark(OTHER, { 'a.ts': null });
    const replaced = treeStamp(root);
    expect(replaced).not.toBe(before);
    rmSync(join(root, MARKER));
    expect(treeStamp(root)).not.toBe(replaced);
  });
});

describe('stampReport', () => {
  it('passes a tree that kept its stamp', () => {
    expect(stampReport('abc', 'abc')).toEqual({ ok: true, text: 'fleet-tree: the tree held abc for the whole run' });
  });

  it('voids the run when the stamp moved', () => {
    expect(stampReport('abc', 'def')).toEqual({
      ok: false,
      text: 'fleet-tree: the tree changed during the run (abc → def); this run is void, and none of its results count',
    });
  });
});
