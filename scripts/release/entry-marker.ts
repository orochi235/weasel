/**
 * The `<!-- entry: … -->` marker that closes every changeset body: what kind of change it is, how
 * far up its release it should sort, and whether the release pick chose it as a highlight.
 *
 *     <!-- entry: rank=10 new api -->
 *     <!-- entry: fix visual pick -->
 *
 * Changesets copies the body into each CHANGELOG.md verbatim, so the marker travels with the entry
 * into the published history, where markdown renders it as nothing. Guide: `docs/releasing.md`.
 */

import { TAGS, type Tag } from '../../apps/shared/releases.ts';

export { GROUPS, groupOf, TAGS, type GroupId, type Tag } from '../../apps/shared/releases.ts';

export interface EntryMeta {
  tags: Tag[];
  /** Author's suggestion of how far up the release this sorts, like a z-index; 0 when unset. */
  rank: number;
  /** Chosen at release time as one of the release's highlights. */
  pick: boolean;
}

export type MarkerResult =
  | { ok: true; meta: EntryMeta; body: string }
  | { ok: false; error: string; body: string };

const MARKER = /<!--\s*entry:([^>]*?)-->/gi;

/** The marker's settings, and the body with the marker cut out. */
export function readMarker(body: string): MarkerResult {
  const found = [...body.matchAll(MARKER)];
  const stripped = body.replace(MARKER, '').replace(/\n{3,}/g, '\n\n').trim();
  if (found.length === 0) return { ok: false, error: 'no <!-- entry: … --> marker', body: stripped };
  if (found.length > 1) return { ok: false, error: 'more than one entry marker', body: stripped };

  const tags: Tag[] = [];
  let rank = 0;
  let pick = false;
  for (const word of found[0][1].trim().split(/\s+/).filter(Boolean)) {
    const rankMatch = /^rank=(-?\d+)$/.exec(word);
    if (rankMatch) rank = Number(rankMatch[1]);
    else if (word === 'pick') pick = true;
    else if (word in TAGS) {
      if (!tags.includes(word as Tag)) tags.push(word as Tag);
    } else return { ok: false, error: `unknown word "${word}" in the entry marker`, body: stripped };
  }
  if (tags.length === 0) return { ok: false, error: 'the entry marker names no tag', body: stripped };
  if (tags.includes('internal') && tags.length > 1) {
    return { ok: false, error: '`internal` cannot be combined with another tag', body: stripped };
  }
  return { ok: true, meta: { tags: sortTags(tags), rank, pick }, body: stripped };
}

export function writeMarker(meta: EntryMeta): string {
  const words = [...(meta.rank ? [`rank=${meta.rank}`] : []), ...sortTags(meta.tags), ...(meta.pick ? ['pick'] : [])];
  return `<!-- entry: ${words.join(' ')} -->`;
}

/** `body` with its marker replaced by one for `meta`, or one appended when it has none. */
export function setMarker(body: string, meta: EntryMeta): string {
  const without = body.replace(MARKER, '').replace(/\s+$/, '');
  return `${without}\n\n${writeMarker(meta)}\n`;
}

function sortTags(tags: readonly Tag[]): Tag[] {
  const order = Object.keys(TAGS);
  return [...tags].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
