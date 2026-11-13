import type { Instrument } from './types';

/**
 * Infers an instrument's state and config types from the literal rather than
 * making them be written out, and returns the spec unchanged, by reference.
 *
 * TypeScript infers all three type arguments or none, so a call that names
 * `TS` and `TC` leaves `TItem` at `unknown` and a job's `onItem` needs a cast.
 * Name the item type too, or pass no type arguments at all.
 */
export function defineInstrument<TS, TC, TItem = unknown>(
  spec: Instrument<TS, TC, TItem>,
): Instrument<TS, TC, TItem> {
  return spec;
}

/** The config a new trial of `instrument` starts from: its `defaultConfig`, else its `config`'s defaults, else
 *  an empty one. */
export function defaultConfigOf<TS, TC, TItem>(instrument: Instrument<TS, TC, TItem>): TC {
  if (instrument.defaultConfig) return instrument.defaultConfig();
  if (instrument.config) return instrument.config.defaults();
  return {} as TC;
}
