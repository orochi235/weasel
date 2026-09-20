/**
 * Refuse a publishable workspace that is missing from the changesets `fixed`
 * group, and refuse a version that has drifted out of lockstep.
 *
 * Every published package moves together: one bump anywhere moves all of them.
 * That is not a property of the repo, it is a property of the one `fixed` array
 * in `.changeset/config.json`, and that array is a hand-written list of names.
 * A package added to `packages/` and not to the list keeps its own version
 * quietly and forever — `changeset version` has no reason to complain, and the
 * drift only shows up when a consumer installs two siblings that disagree.
 *
 * The version check is the same claim from the other side: if the group is
 * right and nobody hand-edited a `package.json`, every member already agrees.
 *
 * Run: node scripts/check-lockstep.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const CONFIG = join(ROOT, '.changeset/config.json');

if (!existsSync(CONFIG)) {
  console.log('[lockstep] no .changeset/config.json — nothing to check.');
  process.exit(0);
}

/** Every workspace under `packages/` that is actually published. */
function publishable() {
  const dir = join(ROOT, 'packages');
  const out = [];
  for (const entry of readdirSync(dir)) {
    const manifest = join(dir, entry, 'package.json');
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    if (pkg.private === true || !pkg.name) continue;
    out.push({ name: pkg.name, version: pkg.version, dir: `packages/${entry}` });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
const groups = config.fixed ?? [];
const pkgs = publishable();
const problems = [];

// A second group would mean two independent version lines, which is a design
// change rather than a mistake — say so rather than guessing which one is home.
if (groups.length > 1) {
  problems.push(
    `\`fixed\` holds ${groups.length} groups; this check assumes one. Teach it the ` +
      `intended shape before adding another.`,
  );
}

const grouped = new Set(groups.flat());

for (const pkg of pkgs) {
  if (!grouped.has(pkg.name)) {
    problems.push(
      `${pkg.name} (${pkg.dir}/package.json) is published but missing from the ` +
        `\`fixed\` group in .changeset/config.json — it will version on its own.`,
    );
  }
}

for (const name of grouped) {
  if (!pkgs.some((p) => p.name === name)) {
    problems.push(
      `${name} is in the \`fixed\` group but is not a published workspace — ` +
        `a rename or a deletion left the list behind.`,
    );
  }
}

const versions = new Map();
for (const pkg of pkgs) {
  if (!grouped.has(pkg.name)) continue;
  const at = versions.get(pkg.version) ?? [];
  at.push(pkg.name);
  versions.set(pkg.version, at);
}

if (versions.size > 1) {
  const spread = [...versions.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([v, names]) => `  ${v.padEnd(12)} ${names.join(', ')}`)
    .join('\n');
  problems.push(`the group spans ${versions.size} versions:\n${spread}`);
}

if (problems.length > 0) {
  for (const p of problems) console.error(`[lockstep] ${p}`);
  console.error(`\n${problems.length} lockstep problem(s).`);
  process.exit(1);
}

const [version] = [...versions.keys()];
console.log(`[lockstep] OK — ${pkgs.length} published package(s), all at ${version}.`);
