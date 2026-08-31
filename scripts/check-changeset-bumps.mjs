/**
 * Refuse any changeset bump above `patch` unless it is explicitly signed off.
 *
 * `patch` is the only bump automation may choose on its own. `minor` and
 * `major` are releases someone decided to make, and each needs a marker in the
 * changeset body naming the level it approves:
 *
 *     <!-- bump-approved: minor: <who> — <why> -->
 *     <!-- bump-approved: major: <who> — <why> -->
 *
 * The level is part of the marker so that approving a `minor` does not
 * silently authorize a later edit to `major`.
 *
 * Why this exists: all thirteen packages are in one changesets `fixed` group,
 * so a single bump anywhere moves every package. weasel reached 1.0.0 on
 * 2026-08-12 by accident that way — two `major` changesets sat in
 * `.changeset/` for days until a release about something else consumed them.
 *
 * Run: node scripts/check-changeset-bumps.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(process.cwd(), '.changeset');

/** Everything above `patch` needs sign-off. */
const GATED = ['minor', 'major'];

/** `<!-- bump-approved: minor: someone — reason -->` */
function approvalFor(text, level) {
  return new RegExp(`<!--\\s*bump-approved:\\s*${level}\\s*:\\s*\\S+.*-->`, 'i').test(text);
}

if (!existsSync(DIR)) {
  console.log('[changeset-bumps] no .changeset directory — nothing to check.');
  process.exit(0);
}

// Changesets 3.x moves a changeset into `.changeset/pre/` once a prerelease
// has consumed it. Those still decide the version every later prerelease
// computes, so a bump hiding in there is exactly the case this guard exists
// for — scan both.
const PRE_DIR = join(DIR, 'pre');
const mds = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md') : [];
const files = [
  ...mds(DIR).map((f) => ({ file: f, path: join(DIR, f), label: `.changeset/${f}` })),
  ...mds(PRE_DIR).map((f) => ({ file: f, path: join(PRE_DIR, f), label: `.changeset/pre/${f}` })),
];
const offenders = [];

for (const { file, path, label } of files) {
  const text = readFileSync(path, 'utf8');
  // Frontmatter is the leading `---` block; only bumps declared there count.
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) continue;

  for (const level of GATED) {
    const pkgs = [...fm[1].matchAll(
      new RegExp(`^\\s*["']?([^"':]+)["']?\\s*:\\s*${level}\\s*$`, 'gm'),
    )].map((m) => m[1].trim());
    if (pkgs.length === 0) continue;
    if (approvalFor(text, level)) {
      console.log(`[changeset-bumps] ${label}: ${level} approved — ${pkgs.join(', ')}`);
      continue;
    }
    offenders.push({ label, level, pkgs });
  }
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

  If Mike has explicitly approved this level, add to the changeset body:
      <!-- bump-approved: ${offenders[0].level}: <who> — <why> -->
`);
  process.exit(1);
}

console.log(`[changeset-bumps] OK — ${files.length} changeset(s), no unapproved bumps above patch.`);
