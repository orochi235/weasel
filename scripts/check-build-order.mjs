/**
 * `npm run build` builds packages one at a time, in the order the `build:*`
 * scripts name them, and a package's type build needs its siblings' `.d.ts`
 * already on disk. A package listed before a dependency builds against no
 * types at all, which a working checkout never shows: its stale `dist` is
 * still there. Only a clean install fails, so this reads the order instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { publishableWorkspaces, repoRoot } from './lib/workspaces.mjs';

const TIERS = ['build:leaves', 'build:core', 'build:downstream'];

const { scripts } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const order = TIERS.flatMap((tier) => [...scripts[tier].matchAll(/-w (@weasel-js\/[\w-]+)/g)].map((m) => m[1]));
const manifests = new Map(publishableWorkspaces().map(({ manifest }) => [manifest.name, manifest]));

const problems = [];
for (const name of manifests.keys()) {
  if (!order.includes(name)) problems.push(`${name} is in no ${TIERS.join(' / ')} script, so npm run build never builds it`);
}
order.forEach((name, i) => {
  const m = manifests.get(name);
  if (!m) return problems.push(`${name} is built but is not a published workspace`);
  const deps = Object.keys({ ...m.dependencies, ...m.peerDependencies }).filter((d) => manifests.has(d));
  for (const dep of deps) {
    if (order.indexOf(dep) > i) problems.push(`${name} builds before ${dep}, which it depends on`);
  }
});

if (problems.length) {
  for (const p of problems) console.error(`[build-order] ${p}`);
  process.exit(1);
}
console.log(`[build-order] OK — ${order.length} package(s), each built after the siblings it depends on.`);
