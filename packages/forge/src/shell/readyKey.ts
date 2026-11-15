import { type FromFrame, stableStringify } from '../protocol/messages';

/** A frame's `ready` message: the story's schema, layout and viewport. */
export type FrameReady = Extract<FromFrame, { type: 'ready' }>;

/** The part of a `ready` an instrument is built from; two readies with one key build the same instrument. */
export const readyKey = (ready: FrameReady): string =>
  stableStringify({ schema: ready.schema, layout: ready.layout, viewport: ready.viewport });
