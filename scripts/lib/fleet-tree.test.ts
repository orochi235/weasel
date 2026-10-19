import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMMIT_ENV, MARKER, armTree, blobHash, changedFiles, checkTree, treeReport } from './fleet-tree.mjs';

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

  it('checks a marker on its own when no commit is named', () => {
    put('src/gone.ts', 'x\n');
    mark(COMMIT, { 'src/gone.ts': null });
    const { armed, problems } = checkTree(root, {});
    expect(armed).toBe(true);
    expect(problems).toHaveLength(1);
  });
});

describe('armTree', () => {
  it('writes the marker and has the plan export the commit to the suite', () => {
    put('.onto/tests', 'plugin: node\nrun: vitest run\n');
    armTree(root, { commit: COMMIT, files: { 'src/a.ts': null } });
    expect(JSON.parse(readFileSync(join(root, MARKER), 'utf8'))).toEqual({ commit: COMMIT, files: { 'src/a.ts': null } });
    expect(readFileSync(join(root, '.onto/tests'), 'utf8')).toBe(
      `plugin: node\nrun: vitest run\nprelude: export ${COMMIT_ENV}=${COMMIT}\n`,
    );
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
