import { type FromFrame, stableStringify } from '../protocol/messages';

export type Ready = Extract<FromFrame, { type: 'ready' }>;

/** The part of a `ready` an instrument is built from; two readies with one key build the same instrument. */
export const readyKey = (ready: Ready): string =>
  stableStringify({ schema: ready.schema, layout: ready.layout, viewport: ready.viewport });
