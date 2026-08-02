// One-time (per package) setup for npm OIDC trusted publishing.
//
// npm revoked all classic tokens on 2025-12-09, and granular tokens now cap at a
// 90-day lifetime — so any token-based release is a rotation treadmill that will
// break again on a schedule. Trusted publishing stores no credential at all: the
// release job mints a short-lived one from its `id-token: write` permission,
// scoped to that single run.
//
// The catch is that npm holds trust config per package, with no org-wide switch,
// so all thirteen workspaces have to be registered individually. `npm trust`
// (npm >= 11.10.0) makes that scriptable instead of thirteen trips through the
// website.
//
// Usage:
//   node scripts/setup-trusted-publishing.mjs --dry-run   # print what it would do
//   node scripts/setup-trusted-publishing.mjs             # actually configure
//   node scripts/setup-trusted-publishing.mjs --list      # show current config
//
// The first call prompts for 2FA. The npm web page shown during that prompt
// offers "skip 2FA for the next 5 minutes" — enable it, and the rest run
// unattended. The 2s pause between calls is npm's own rate-limit guidance.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = 'release.yml';

/** Everything `changeset publish` would push, i.e. every non-private workspace. */
function publishablePackages() {
  const { workspaces = [] } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const out = [];
  for (const pattern of workspaces) {
    if (!pattern.endsWith('/*')) throw new Error(`unsupported workspace pattern: ${pattern}`);
    const parent = join(repoRoot, pattern.slice(0, -2));
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(join(parent, entry.name, 'package.json'), 'utf8'));
      } catch {
        continue; // not a workspace (no manifest) — e.g. a docs-only directory
      }
      // `weasel-js` is private on purpose: npm rejects the unscoped name as too
      // similar to an existing package. It has nothing to trust-configure.
      if (manifest.private) continue;
      out.push(manifest.name);
    }
  }
  return out.sort();
}

/** `owner/repo`, read from the manifest so this can't drift from the real remote. */
function repoSlug() {
  const { repository } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const url = typeof repository === 'string' ? repository : repository?.url;
  const match = /github\.com[/:]([^/]+\/[^/.]+)/.exec(url ?? '');
  if (!match) throw new Error(`could not read a GitHub owner/repo out of: ${url}`);
  return match[1];
}

/**
 * Whether this npm knows `--allow-publish`.
 *
 * The permission flags arrived with staged publishing, after `npm trust` itself
 * — npm 11.13.0 has the command but rejects the flag as unknown. Passing it
 * blind breaks on older CLIs; omitting it blind means newer CLIs may refuse a
 * config that names no permitted action. So ask the CLI in front of us.
 */
function supportsPermissionFlags() {
  try {
    const help = execFileSync('npm', ['trust', 'github', '--help'], { encoding: 'utf8' });
    return help.includes('--allow-publish');
  } catch {
    return false;
  }
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const listOnly = args.has('--list');
const packages = publishablePackages();
const slug = repoSlug();
const permissionFlags = supportsPermissionFlags() ? ['--allow-publish'] : [];

console.log(`${listOnly ? 'Listing' : 'Configuring'} ${packages.length} packages`);
console.log(`  repository: ${slug}`);
console.log(`  workflow:   .github/workflows/${WORKFLOW}`);
if (!listOnly) {
  console.log(
    permissionFlags.length
      ? '  permissions: --allow-publish'
      : '  permissions: default (this npm predates --allow-publish; upgrade to grant them explicitly)',
  );
}
console.log();

let failed = 0;
for (const [i, pkg] of packages.entries()) {
  const argv = listOnly
    ? ['trust', 'list', pkg]
    : ['trust', 'github', pkg, '--file', WORKFLOW, '--repo', slug, ...permissionFlags, '--yes'];

  if (dryRun) {
    console.log(`[dry-run] npm ${argv.join(' ')}`);
    continue;
  }

  try {
    const out = execFileSync('npm', argv, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
    console.log(`✓ ${pkg}${out.trim() ? `\n${out.trim()}` : ''}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${pkg}: ${(err.stderr || err.message).toString().trim()}`);
  }

  // Rate limiting, per npm's bulk-configuration guidance. Skipped after the last
  // package so the script doesn't idle on the way out.
  if (i < packages.length - 1) {
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},2000)']);
  }
}

if (failed) {
  console.error(`\n${failed} package(s) failed. Re-run — trust config is idempotent.`);
  process.exit(1);
}
if (!dryRun) console.log('\nDone. Verify with: node scripts/setup-trusted-publishing.mjs --list');
