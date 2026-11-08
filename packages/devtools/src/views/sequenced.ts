/** A record a cursor read, with its place in the page's ring: what a row is keyed by, since it never changes. */
export interface Sequenced<T> {
  seq: number;
  record: T;
}

/** `entries` as one read handed them back, numbered from where the ring stood before them: `cursor` is the one after the last. */
export function sequenced<T>(entries: readonly T[], cursor: number): Sequenced<T>[] {
  const first = cursor - entries.length;
  return entries.map((record, i) => ({ seq: first + i, record }));
}
