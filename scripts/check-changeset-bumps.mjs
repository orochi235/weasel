/**
 * Refuse any changeset bump above `patch` unless it is explicitly signed off.
 *
 * `minor` and `major` each need a marker in the changeset body naming the
 * level it approves:
 *
 *     <!-- bump-approved: minor: <who> — <why> -->
 *     <!-- bump-approved: major: <who> — <why> -->
 *
 * The level is part of the marker so that approving a `minor` does not
 * silently authorize a later edit to `major`. Every published package is in
 * one changesets `fixed` group, so a single bump anywhere moves every package.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBumps } from './lib/changeset-bumps.mjs';

// From the script's own place, so a run from another directory still looks.
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.changeset');

if (!existsSync(DIR)) {
  console.log('[changeset-bumps] no .changeset directory — nothing to check.');
  process.exit(0);
}

// Changesets 3.x moves a changeset into `.changeset/pre/` once a prerelease
// has consumed it. Those still decide the version every later prerelease
// computes, so scan both.
const PRE_DIR = join(DIR, 'pre');
// The files changesets itself skips (`@changesets/read`).
const NOT_CHANGESETS = /^(readme|AGENTS|CLAUDE|GEMINI)\.md$/i;
const mds = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.') && !NOT_CHANGESETS.test(f)) : [];
const files = [
  ...mds(DIR).map((f) => ({ file: f, path: join(DIR, f), label: `.changeset/${f}` })),
  ...mds(PRE_DIR).map((f) => ({ file: f, path: join(PRE_DIR, f), label: `.changeset/pre/${f}` })),
];
const offenders = [];
const leading = [];
const unreadable = [];

for (const { path, label } of files) {
  let read;
  try {
    read = readBumps(readFileSync(path, 'utf8'));
  } catch (e) {
    unreadable.push(`${label}: ${String(e instanceof Error ? e.message : e).split('\n')[0]}`);
    continue;
  }
  if (read.leadingMarker) leading.push(label);
  for (const { level, pkgs } of read.approved) {
    console.log(`[changeset-bumps] ${label}: ${level} approved — ${pkgs.join(', ')}`);
  }
  for (const { level, pkgs } of read.unapproved) offenders.push({ label, level, pkgs });
}

if (unreadable.length > 0) {
  console.error(`\n[changeset-bumps] BLOCKED: changesets cannot read ${unreadable.length} file(s):`);
  for (const line of unreadable) console.error(`  ${line}`);
}

if (leading.length > 0) {
  console.error(`\n[changeset-bumps] BLOCKED: a bump-approved marker opens the body of ${leading.join(', ')}.`);
  console.error(`  The changelog shows a body's first line as the entry's title. Move the marker to the end.\n`);
}

if (offenders.length > 0) {
  console.error(`\n[changeset-bumps] BLOCKED: ${offenders.length} unapproved bump(s) above patch.\n`);
  for (const { label, level, pkgs } of offenders) {
    console.error(`  ${label}`);
    for (const pkg of pkgs) console.error(`      ${pkg}: ${level}`);
  }
  console.error(`
  'patch' is the only bump that ships without a human deciding to ship it.
  All packages share one 'fixed' group, so ONE bump here moves ALL of them.

  This check exists because 0.8.0 became 1.0.0 by accident on 2026-08-12,
  from majors that had been sitting in the backlog.

  If you are an agent, or you did not specifically intend this release:
      change the bump to 'patch'. Say what changed in the prose instead —
      the words are what a reader acts on.

  If the maintainer has explicitly approved this level, add to the end of the changeset body:
      <!-- bump-approved: ${offenders[0].level}: <who> — <why> -->
`);
  process.exit(1);
}
if (leading.length > 0 || unreadable.length > 0) process.exit(1);

console.log(`[changeset-bumps] OK — ${files.length} changeset(s), no unapproved bumps above patch.`);
