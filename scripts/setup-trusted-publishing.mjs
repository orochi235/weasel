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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { publishablePackageNames, repoRoot } from './lib/workspaces.mjs';

const WORKFLOW = 'release.yml';

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
 * — npm 11.13.0 has the command but rejects the flag as unknown.
 */
function supportsPermissionFlags() {
  try {
    const help = execFileSync('npm', ['trust', 'github', '--help'], { encoding: 'utf8' });
    return help.includes('--allow-publish');
  } catch {
    return false;
  }
}

/**
 * How to invoke npm, given the flags the local one supports.
 *
 * Omitting the permission flag is not a graceful degradation — the registry has
 * required a config to name at least one permitted action since 2026-05-20, and
 * rejects a request without one as a bare `400 Bad Request`, no body, from
 * inside npm's 2FA wrapper. It reads like an auth failure and is not one.
 *
 * So an npm too old to send permissions is not usable here at all, and we fetch
 * one that is rather than fail. This deliberately does not touch the globally
 * installed npm: this script is the only thing that needs the newer CLI.
 */
function npmCommand() {
  if (supportsPermissionFlags()) return { bin: 'npm', prefix: [], via: 'npm (local)' };
  return { bin: 'npx', prefix: ['-y', 'npm@latest'], via: 'npx npm@latest (local npm predates --allow-publish)' };
}

const argvIn = process.argv.slice(2);
const args = new Set(argvIn);
const dryRun = args.has('--dry-run');
const listOnly = args.has('--list');
// `--otp=123456` skips the interactive 2FA prompt. A code is good for ~30s, so
// it will not carry all twelve packages on its own — its real use is retrying
// the tail after the 5-minute skip window lapsed.
const otp = argvIn.find((a) => a.startsWith('--otp='));
const packages = publishablePackageNames();
const slug = repoSlug();
const npmCmd = npmCommand();

console.log(`${listOnly ? 'Listing' : 'Configuring'} ${packages.length} packages`);
console.log(`  repository: ${slug}`);
console.log(`  workflow:   .github/workflows/${WORKFLOW}`);
if (!listOnly) console.log('  permissions: publish');
console.log(`  npm:        ${npmCmd.via}`);
console.log();

let failed = 0;
for (const [i, pkg] of packages.entries()) {
  const argv = [
    ...npmCmd.prefix,
    ...(listOnly
      ? ['trust', 'list', pkg]
      : [
          'trust',
          'github',
          pkg,
          '--file',
          WORKFLOW,
          '--repo',
          slug,
          '--allow-publish',
          ...(otp ? [otp] : []),
          '--yes',
        ]),
  ];

  if (dryRun) {
    console.log(`[dry-run] ${npmCmd.bin} ${argv.join(' ')}`);
    continue;
  }

  console.log(`→ ${pkg}`);
  try {
    // Fully inherited stdio, deliberately. npm's 2FA challenge is interactive —
    // capturing its output to prettify this loop swallows the prompt, and the
    // run stalls looking like a hang. Legible progress is not worth that.
    execFileSync(npmCmd.bin, argv, { stdio: 'inherit' });
  } catch {
    failed += 1;
    console.error(`✗ ${pkg} failed (see npm output above)`);
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
