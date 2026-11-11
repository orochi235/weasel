import { parseChangesetFile } from '@changesets/parse';
import { readMarker, type Tag } from './entry-marker.ts';
import { splitSummary } from './summary.ts';

/** Longest a title may run, as plain text. */
export const TITLE_LIMIT = 140;
/** Longest the whole prose of an entry tagged only `fix` (and `visual`) may run. */
export const FIX_LIMIT = 700;

/** What is wrong with one changeset file, one line per problem; empty when nothing is. */
export function lintChangeset(text: string): string[] {
  let summary: string;
  try {
    summary = parseChangesetFile(text).summary;
  } catch (e) {
    return [`changesets cannot read it: ${String(e instanceof Error ? e.message : e).split('\n')[0]}`];
  }

  const problems: string[] = [];
  const marker = readMarker(summary);
  if (!marker.ok) problems.push(marker.error);
  if (/^<!--\s*entry:/i.test(summary)) problems.push('the entry marker opens the body; move it to the end');
  if (!marker.body) return [...problems, 'no prose'];

  const [title, rest] = splitSummary(marker.body);
  const plain = title.replace(/`/g, '');
  if (plain.length > TITLE_LIMIT) {
    problems.push(`the title runs ${plain.length} characters; keep it under ${TITLE_LIMIT}`);
  }
  if (isGrabBag(plain)) {
    problems.push('the title lists several changes; write one changeset per change');
  }
  if (!marker.ok) return problems;

  const tags: Tag[] = marker.meta.tags;
  if (tags.includes('breaking') && !rest) {
    problems.push('a `breaking` entry needs a body saying what to change');
  }
  if (tags.every((t) => t === 'fix' || t === 'visual') && marker.body.length > FIX_LIMIT) {
    problems.push(`a fix runs ${marker.body.length} characters; keep it under ${FIX_LIMIT}, and leave out how it used to fail`);
  }
  return problems;
}

/** "Fixes to …", "A fix to …", or a "Fix …" title running three or more things together. */
export function isGrabBag(title: string): boolean {
  if (/^(fixes|a fix|several fixes|two fixes|three fixes)\b/i.test(title)) return true;
  return /^fix(es)?\b/i.test(title) && (title.match(/,/g)?.length ?? 0) >= 2;
}
