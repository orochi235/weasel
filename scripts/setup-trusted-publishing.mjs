// One-time (per package) setup for npm OIDC trusted publishing.
//
// Trusted publishing stores no credential: the release job mints a short-lived
// one from its `id-token: write` permission, scoped to that single run. npm
// holds trust config per package, with no org-wide switch, so every workspace
// has to be registered individually with `npm trust` (npm >= 11.10.0).
//
// Usage:
//   node scripts/setup-trusted-publishing.mjs                     # every package
//   node scripts/setup-trusted-publishing.mjs kernel3d            # just this one
//   node scripts/setup-trusted-publishing.mjs @weasel-js/geom d3  # or several
//   node scripts/setup-trusted-publishing.mjs --dry-run           # print, don't call
//   node scripts/setup-trusted-publishing.mjs --list kernel3d     # show current config
//
// Name packages when you are seeding one — the full sweep is one `npm trust`
// call per package, each with its own 2FA challenge and rate-limit pause.
//
// The first call prompts for 2FA. The npm web page shown during that prompt
// offers "skip 2FA for the next 5 minutes" — enable it, and the rest run
// unattended.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addPending, hasTrustedPublish, readPending, writePending } from './lib/first-publish.mjs';
import { fetchPackument } from './lib/registry.mjs';
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

/** Whether this npm knows `--allow-publish`: npm 11.13.0 has `npm trust` but rejects the flag as unknown. */
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
 * The registry requires a config to name at least one permitted action, and
 * rejects a request without one as a bare `400 Bad Request`, no body, from
 * inside npm's 2FA wrapper. It reads like an auth failure and is not one. So an
 * npm too old to send permissions is replaced by `npx npm@latest`, leaving the
 * globally installed npm alone.
 */
function npmCommand() {
  if (supportsPermissionFlags()) return { bin: 'npm', prefix: [], via: 'npm (local)' };
  return { bin: 'npx', prefix: ['-y', 'npm@latest'], via: 'npx npm@latest (local npm predates --allow-publish)' };
}

/**
 * The packages named on the command line, or all of them when none are. A bare
 * `kernel3d` resolves against the scoped names. An unknown name stops the run:
 * silently configuring nothing looks identical to success.
 */
function selectPackages(all, named) {
  if (named.length === 0) return all;
  const bySuffix = new Map(all.map((name) => [name.replace(/^@[^/]+\//, ''), name]));
  const chosen = [];
  const unknown = [];
  for (const name of named) {
    const match = all.includes(name) ? name : bySuffix.get(name);
    if (match) chosen.push(match);
    else unknown.push(name);
  }
  if (unknown.length > 0) {
    console.error(`No such publishable workspace: ${unknown.join(', ')}`);
    console.error(`\nKnown packages:\n${all.map((n) => `  ${n}`).join('\n')}`);
    process.exit(1);
  }
  return [...new Set(chosen)];
}

const argvIn = process.argv.slice(2);
const args = new Set(argvIn);
const dryRun = args.has('--dry-run');
const listOnly = args.has('--list');
// `--otp=123456` skips the interactive 2FA prompt. A code is good for ~30s, so
// it will not carry a full sweep on its own.
const otp = argvIn.find((a) => a.startsWith('--otp='));
const all = publishablePackageNames();
const packages = selectPackages(all, argvIn.filter((a) => !a.startsWith('--')));
const slug = repoSlug();
const npmCmd = npmCommand();

console.log(
  `${listOnly ? 'Listing' : 'Configuring'} ${packages.length} of ${all.length} packages` +
    (packages.length === all.length ? '' : `: ${packages.join(', ')}`),
);
console.log(`  repository: ${slug}`);
console.log(`  workflow:   .github/workflows/${WORKFLOW}`);
if (!listOnly) console.log('  permissions: publish');
console.log(`  npm:        ${npmCmd.via}`);
console.log();

let failed = 0;
const configured = [];
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
    // Fully inherited stdio: npm's 2FA challenge is interactive, and capturing
    // its output swallows the prompt, so the run stalls looking like a hang.
    execFileSync(npmCmd.bin, argv, { stdio: 'inherit' });
    if (!listOnly) configured.push(pkg);
  } catch {
    failed += 1;
    console.error(`✗ ${pkg} failed (see npm output above)`);
  }

  // Rate limiting, per npm's bulk-configuration guidance.
  if (i < packages.length - 1) {
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},2000)']);
  }
}

// The first-publish gate cannot read trust config, only whether a version came
// from a trusted publisher, so a registration it cannot see yet is recorded here.
const unseen = [];
for (const pkg of configured) {
  if (!hasTrustedPublish(await fetchPackument(pkg))) unseen.push(pkg);
}
if (unseen.length > 0) {
  writePending(addPending(readPending(), unseen));
  console.log(`\nRecorded in scripts/trust-pending.json, which needs committing: ${unseen.join(', ')}`);
}

if (failed) {
  console.error(`\n${failed} package(s) failed. Re-run — trust config is idempotent.`);
  process.exit(1);
}
if (!dryRun) console.log('\nDone. Verify with: node scripts/setup-trusted-publishing.mjs --list');
