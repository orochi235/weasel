import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkTree } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * A node holds one tree per repository and every session's run syncs into it, so the tree a suite
 * starts in can be another run's. `fleet-test.mjs` arms this; with no fleet run there is nothing to check.
 */
describe('the tree a fleet run tests', () => {
  const check = checkTree(ROOT, process.env);

  it.skipIf(!check.armed)(`is the commit asked for${check.commit ? `, ${check.commit.slice(0, 9)}` : ''}`, () => {
    if (check.problems.length > 0) {
      const shown = check.problems.slice(0, 20).join('\n  ');
      expect.fail(`this fleet run tested the wrong tree, so no other result in it counts:\n  ${shown}`);
    }
    console.log(`fleet-tree: ${check.checked} changed path(s) match ${check.commit}`);
  });
});
