import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkTree, treeReport } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * A node holds one tree per repository and every session's run syncs into it, so the tree a suite
 * starts in can be another run's. `fleet-test.mjs` arms this; with no fleet run there is nothing to check.
 */
describe('the tree a fleet run tests', () => {
  const check = checkTree(ROOT, process.env);

  it.skipIf(!check.armed)(`is the commit asked for${check.commit ? `, ${check.commit.slice(0, 9)}` : ''}`, () => {
    const report = treeReport(check);
    if (!report.ok) expect.fail(report.text);
    console.log(report.text);
  });
});
