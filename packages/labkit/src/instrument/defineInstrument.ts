import type { Instrument } from './types';

/** Identity at runtime; exists so an instrument's state and config types are
 *  inferred from the spec rather than having to be written out. */
export function defineInstrument<TS, TC>(spec: Instrument<TS, TC>): Instrument<TS, TC> {
  return spec;
}
