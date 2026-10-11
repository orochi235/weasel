/**
 * The kit-wide "these values disagree" sentinel. Used wherever a value is
 * aggregated across more than one source and the sources don't agree — e.g.
 * a UI panel aggregating a property across a multi-node selection, or text
 * styling aggregated across the runs in a character range. One symbol, one
 * `isMixed` check, regardless of what's being aggregated.
 */
export const MIXED: unique symbol = Symbol('weasel:mixed');
/** The type of {@link MIXED}. Property panels use it to say "the selection
 *  does not agree on this value" without colliding with any real value. */
export type Mixed = typeof MIXED;
