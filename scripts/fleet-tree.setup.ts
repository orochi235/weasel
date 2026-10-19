import { fileURLToPath } from 'node:url';
import { checkTree, treeReport } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The tree check, once per vitest process. `onto test --spread` gives each node a slice of the
 * test files, so `fleet-tree.gate.ts` lands in one slice and checks one node's tree; this checks
 * every node's. A wrong tree fails the slice before any test runs.
 */
export default function setup() {
  const check = checkTree(ROOT, process.env);
  if (!check.armed) return;
  const report = treeReport(check);
  if (!report.ok) throw new Error(report.text);
  console.log(report.text);
}
