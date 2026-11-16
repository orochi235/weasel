import type { PrefBase } from './schema';

/**
 * A line of text among the rows, holding no value: `name` is the line and
 * `description` the note under it. A store neither reads nor writes one, and
 * its path is not a {@link PrefPath}.
 */
export type PrefLabel = PrefBase<'label', undefined>;

/** A rule drawn between the rows, holding no value and drawing none of its own text. */
export type PrefSeparator = PrefBase<'separator', undefined>;
