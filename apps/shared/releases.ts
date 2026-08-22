/**
 * The shape of the release history the demo site's Releases view renders.
 *
 * Produced at build time by the `changelogs` vite plugin
 * (`scripts/vite-changelogs.ts`) from the packages' CHANGELOG files, and
 * consumed through the `virtual:changelogs` module. The types live here rather
 * than in the plugin because the site's tsconfig covers `apps/` but not
 * `scripts/`, so a type imported from the plugin resolves to `any`.
 */

/** One changeset, as it appeared in one or more packages' changelogs. */
export interface ChangelogEntry {
  /** Changeset hash, or a synthesized key when the entry has none. */
  id: string;
  /** Unscoped package names this entry appeared in, alphabetical. */
  packages: string[];
  /** The entry's opening paragraph as HTML, inline-rendered. */
  titleHtml: string;
  /** Everything after the opening paragraph as HTML. Often empty. */
  bodyHtml: string;
  level: 'major' | 'minor' | 'patch';
}

/** One published version. All packages share a version, so a release is the
 *  union of what every package recorded under that number. */
export interface Release {
  version: string;
  /** Author date of the commit that introduced this version's heading. */
  date?: string;
  entries: ChangelogEntry[];
}
