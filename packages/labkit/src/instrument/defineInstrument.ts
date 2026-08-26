import type { Instrument } from './types';

/** Identity at runtime; exists so an instrument's state and config types are
 *  inferred from the spec rather than having to be written out.
 *
 *  TypeScript infers all three or none, so a call that names `TS` and `TC`
 *  leaves `TItem` at `unknown` and a job's `onItem` needs a cast. Name the
 *  item type too, or pass no type arguments at all. */
export function defineInstrument<TS, TC, TItem = unknown>(
  spec: Instrument<TS, TC, TItem>,
): Instrument<TS, TC, TItem> {
  return spec;
}
