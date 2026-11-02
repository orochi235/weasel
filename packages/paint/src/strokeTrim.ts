/**
 * Where along a path a {@link StrokeTrim} edge sits. A bare number is a
 * fraction of the whole path; the object forms name an absolute distance, an
 * anchor (vertex) index, or a subpath index.
 */
export type TrimAt = number | { length: number } | { anchor: number } | { subpath: number };

/** What a fractional trim edge advances by: arc length, or anchor by anchor. */
export type TrimPace = 'length' | 'anchor';

/** The stretch of a path a stroke draws, so a path can be drawn on in pen order. */
export interface StrokeTrim {
  start?: TrimAt;
  end?: TrimAt;
  pace?: TrimPace;
}

/** A stable string per trim value, `''` for no trim; for cache and equality keys. An omitted
 *  edge keys as its default, so `{ end: 0.5 }` and `{ start: 0, end: 0.5 }` share one. */
export function strokeTrimKey(trim: StrokeTrim | undefined): string {
  if (trim === undefined) return '';
  return `trim(${atKey(trim.start ?? 0)},${atKey(trim.end ?? 1)},${trim.pace ?? 'length'})`;
}

function atKey(at: TrimAt): string {
  if (typeof at === 'number') return String(at);
  if ('length' in at) return `l${at.length}`;
  if ('anchor' in at) return `a${at.anchor}`;
  return `s${at.subpath}`;
}
