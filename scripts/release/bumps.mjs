// What a changeset asks for, read by changesets' own parser, so a file it versions from is read
// here the same way: frontmatter after a blank line or a BOM, and any YAML spelling of a level.
import { parseChangesetFile } from '@changesets/parse';

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
 * A changeset's text with every package it releases released at `level`, the one the release
 * was cut at; a package it marks `none` stays `none`. Throws on a file changesets cannot read.
 */
export function atLevel(text, level) {
  if (!LEVELS.includes(level)) throw new Error(`unknown release level ${JSON.stringify(level)}`);
  const { releases, summary } = parseChangesetFile(text);
  const lines = releases.map(({ name, type }) => `${JSON.stringify(name)}: ${type === 'none' ? 'none' : level}`);
  return `---\n${lines.join('\n')}\n---\n\n${summary}\n`;
}
