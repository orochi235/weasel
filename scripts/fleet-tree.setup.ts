import { fileURLToPath } from 'node:url';
import { checkTree, stampReport, treeReport, treeStamp } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The tree check, once per vitest process. `onto test --spread` gives each node a slice of the
 * test files, so `fleet-tree.gate.ts` lands in one slice and checks one node's tree; this checks
 * every node's. A wrong tree fails the slice before any test runs, and a sync landing mid-run fails
 * it at the end, after the summary, so the failures it caused are not read as real.
 */
export default function setup() {
  const check = checkTree(ROOT, process.env);
  if (!check.armed) return;
  const report = treeReport(check);
  if (!report.ok) throw new Error(report.text);
  console.log(report.text);
  const before = treeStamp(ROOT);
  return () => {
    const end = stampReport(before, treeStamp(ROOT));
    if (!end.ok) throw new Error(end.text);
    console.log(end.text);
  };
}
