// The body of a package's GitHub release: its changelog section for one
// version, cut to what GitHub accepts.

/** GitHub refuses a release body over 125,000 characters. */
export const BODY_LIMIT = 125_000;

/** The text under `## <version>` in a changesets changelog, or null when it has none. */
export function changelogSection(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) return null;
  let end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end).join('\n').trim();
}

/**
 * `section`, or as many of its whole entries as fit under `limit` followed by
 * a link to the rest. An entry begins at a top-level `- `.
 */
export function releaseBody(section, { changelogUrl, limit = BODY_LIMIT }) {
  if (section.length <= limit) return section;
  const tail = `\n\nThese notes are cut short. The rest is in the [changelog](${changelogUrl}).`;
  const budget = limit - tail.length;
  const boundary = section.lastIndexOf('\n- ', budget);
  const kept = boundary > 0 ? section.slice(0, boundary) : section.slice(0, budget);
  return kept.trimEnd() + tail;
}
