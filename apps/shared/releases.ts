/**
 * The shape of the release history the demo site's Releases view renders, and the vocabulary of
 * entry tags and groups it sorts by.
 *
 * Produced at build time by the `changelogs` vite plugin (`scripts/release/changelogs.ts`) from the
 * packages' CHANGELOG files, and consumed through the `virtual:changelogs` module. The types live
 * here rather than in the plugin because the site's tsconfig covers `apps/` but not `scripts/`, so
 * a type imported from the plugin resolves to `any`.
 */

/** Each tag answers one yes-or-no question about a change; an entry carries every one that holds. */
export const TAGS = {
  breaking: 'consumer code or saved data has to change',
  deprecates: 'marks something deprecated; it still works',
  api: 'adds public surface: an export, a prop, an option, an action id',
  new: 'a capability a user can see, with or without new API',
  behavior: 'existing code acts differently with no code change, on purpose and not as a fix',
  data: 'changes serialized output or how saved documents load',
  visual: 'rendered pixels differ',
  perf: 'measurably faster or leaner',
  fix: 'corrects a defect',
  internal: 'nothing a consumer can observe',
} as const;

export type Tag = keyof typeof TAGS;

/** Where an entry is listed in its release: the first group, in this order, that its tags reach. */
export const GROUPS = [
  { id: 'breaking', label: 'Breaking', tags: ['breaking'], folded: false },
  { id: 'new', label: 'New', tags: ['new', 'api'], folded: false },
  { id: 'changed', label: 'Changed', tags: ['behavior', 'deprecates', 'data'], folded: false },
  { id: 'perf', label: 'Performance', tags: ['perf'], folded: false },
  { id: 'fix', label: 'Fixes', tags: ['fix', 'visual'], folded: true },
  { id: 'internal', label: 'Internal', tags: ['internal'], folded: true },
] as const satisfies readonly { id: string; label: string; tags: readonly Tag[]; folded: boolean }[];

export type GroupId = (typeof GROUPS)[number]['id'];

/** An entry with no tags (published before markers, and missing from the backfill) reads as changed. */
export function groupOf(tags: readonly Tag[]): GroupId {
  for (const group of GROUPS) if (group.tags.some((t: Tag) => tags.includes(t))) return group.id;
  return 'changed';
}

/** One changeset, as it appeared in one or more packages' changelogs. */
export interface ChangelogEntry {
  /** Changeset hash, or a synthesized key when the entry has none. */
  id: string;
  /** Unscoped package names this entry appeared in, alphabetical. */
  packages: string[];
  /** The entry's opening sentence as HTML, inline-rendered. */
  titleHtml: string;
  /** Everything after the opening sentence as HTML. Often empty. */
  bodyHtml: string;
  tags: Tag[];
  /** The author's sort suggestion, higher first; 0 when unset. */
  rank: number;
  /** Chosen at release time as one of the release's highlights. */
  pick: boolean;
}

/** One published version, with every entry. All packages share a version, so a release is the
 *  union of what every package recorded under that number. */
export interface Release {
  version: string;
  /** Author date of the commit that introduced this version's heading. */
  date?: string;
  entries: ChangelogEntry[];
}

/** An entry shown at the top of its release, before the release's entries are loaded. */
export type Highlight = Pick<ChangelogEntry, 'id' | 'titleHtml' | 'packages' | 'tags'>;

/** What the Releases view knows about a release before it is opened. */
export interface ReleaseSummary {
  version: string;
  date?: string;
  /** Each entry's group and packages, in entry order: enough to count and filter a release
   *  without loading it. */
  shape: { group: GroupId; packages: string[] }[];
  /** The picks, or when there are none the top-ranked entries outside Internal. */
  highlights: Highlight[];
  /** Whether `highlights` were picked rather than fallen back to. */
  curated: boolean;
}

/** One entry of `virtual:changelogs`: a summary, and its entries fetched on demand. */
export interface ReleaseIndexEntry extends ReleaseSummary {
  load: () => Promise<ChangelogEntry[]>;
}

/** How many entries a release without picks shows at its top, and how many it needs before it
 *  shows any: a short release is its own summary. */
export const FALLBACK_HIGHLIGHTS = 3;
export const FALLBACK_MIN_ENTRIES = 8;

const GROUP_ORDER = new Map<GroupId, number>(GROUPS.map((g, i) => [g.id, i]));

/** Group first, then rank, then breadth. */
export function compareEntries(a: ChangelogEntry, b: ChangelogEntry): number {
  return (
    GROUP_ORDER.get(groupOf(a.tags))! - GROUP_ORDER.get(groupOf(b.tags))! ||
    b.rank - a.rank ||
    b.packages.length - a.packages.length
  );
}

export function summarize(release: Release): ReleaseSummary {
  const picks = release.entries.filter((e) => e.pick);
  const chosen = picks.length
    ? picks
    : release.entries.length < FALLBACK_MIN_ENTRIES
      ? []
      : release.entries
        .filter((e) => groupOf(e.tags) !== 'internal')
        .sort((a, b) => b.rank - a.rank || compareEntries(a, b))
        .slice(0, FALLBACK_HIGHLIGHTS);
  return {
    version: release.version,
    ...(release.date ? { date: release.date } : {}),
    shape: release.entries.map((e) => ({ group: groupOf(e.tags), packages: e.packages })),
    highlights: chosen.map(({ id, titleHtml, packages: p, tags }) => ({ id, titleHtml, packages: p, tags })),
    curated: picks.length > 0,
  };
}

/** Whether an entry naming `packages` survives a filter to `selected`: any of them, or no filter. */
export function matches(packages: readonly string[], selected: readonly string[]): boolean {
  return selected.length === 0 || packages.some((p) => selected.includes(p));
}

/** Entries per group among those `selected` keeps, in group order, leaving out empty groups. */
export function countGroups(
  shape: ReleaseSummary['shape'],
  selected: readonly string[],
): { id: GroupId; label: string; count: number }[] {
  return GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    count: shape.filter((s) => s.group === g.id && matches(s.packages, selected)).length,
  })).filter((g) => g.count > 0);
}

/** An index whose entries are already in hand: what tests and anything without the plugin use. */
export function indexReleases(releases: readonly Release[]): ReleaseIndexEntry[] {
  return releases.map((release) => ({
    ...summarize(release),
    load: () => Promise.resolve(release.entries),
  }));
}
