import type { Instrument } from './types';

export function defineInstrument<TS, TC>(spec: Instrument<TS, TC>): Instrument<TS, TC> {
  return spec;
}
