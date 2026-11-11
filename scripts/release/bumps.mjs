// What a changeset asks for, read by changesets' own parser, so a file it versions from is read
// here the same way: frontmatter after a blank line or a BOM, and any YAML spelling of a level.
import { parseChangesetFile } from '@changesets/parse';
import inc from 'semver/functions/inc.js';

/** The names `@changesets/read` passes over; only README matches without regard to case. */
const NOT_CHANGESETS = [/^README\.md$/i, 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];

/** Whether changesets reads the file named `name` in `.changeset/` as a changeset. */
export function isChangesetFile(name) {
  return (
    name.endsWith('.md') &&
    !name.startsWith('.') &&
    !NOT_CHANGESETS.some((skip) => (typeof skip === 'string' ? skip === name : skip.test(name)))
  );
}

/** The release levels `version-packages --bump` takes. */
export const LEVELS = ['patch', 'minor', 'major'];

/**
 * `plan` with every package it releases moved to the next `level` version, whatever its changesets
 * ask for: the release level is chosen when versioning. The changesets themselves are left as
 * written, so each changelog entry is still listed under its own change's level. A package the
 * plan does not release stays out.
 */
export function releasedAt(plan, level) {
  if (!LEVELS.includes(level)) throw new Error(`unknown release level ${JSON.stringify(level)}`);
  return {
    ...plan,
    releases: plan.releases.map((r) => (r.type === 'none' ? r : { ...r, type: level, newVersion: inc(r.oldVersion, level) })),
  };
}
