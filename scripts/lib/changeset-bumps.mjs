// What a changeset asks for, read by changesets' own parser, so a file it versions from is a
// file the bump check reads the same way: frontmatter after a blank line or a BOM, and any YAML
// spelling of a level.
import { parseChangesetFile } from '@changesets/parse';

/** Everything above `patch` needs sign-off. */
const GATED = ['minor', 'major'];

/** `<!-- bump-approved: minor: someone — reason -->` */
function approvalFor(text, level) {
  return new RegExp(`<!--\\s*bump-approved:\\s*${level}\\s*:\\s*\\S+.*-->`, 'i').test(text);
}

/**
 * The bumps above `patch` in a changeset's text, split by whether a marker in its body approves
 * their level, and whether a marker opens the body. Throws on a file changesets cannot read.
 */
export function readBumps(text) {
  const { releases, summary } = parseChangesetFile(text);
  const byLevel = new Map();
  for (const { name, type } of releases) {
    if (type === 'patch' || type === 'none') continue;
    byLevel.set(type, [...(byLevel.get(type) ?? []), name]);
  }
  const approved = [];
  const unapproved = [];
  for (const [level, pkgs] of byLevel) {
    (GATED.includes(level) && approvalFor(summary, level) ? approved : unapproved).push({ level, pkgs });
  }
  // Changesets prints a body's first line beside the commit hash, the entry's title.
  return { approved, unapproved, leadingMarker: /^<!--\s*bump-approved:/i.test(summary) };
}
