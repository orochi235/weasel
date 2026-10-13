/**
 * "A glyph the renderer asked for can now paint" — the redraw signal shared
 * by every asynchronous glyph source. Both lazy tiers land their work after
 * the frame that asked for it, so both have to tell the canvas to draw again.
 */

import { createEmitter } from '@weasel-js/registry';

let ready = createEmitter();

/** Advanced by every `notifyGlyphReady`, so state can be checked rather than
 *  listened for. See {@link glyphGeneration}. */
let generation = 0;

/**
 * How many times glyph availability has changed — the pull-based companion to
 * {@link subscribeGlyphReady}, for caches that cannot hold a subscription.
 * Subscribing at module load makes a consumer partially mocking
 * `@weasel-js/font` break at import rather than at use.
 *
 * Callers keep the last value they saw and compare; any difference means
 * anything derived from font metrics is stale. The absolute value carries no
 * meaning and may wrap in principle — compare with `!==`, not `<`.
 */
export function glyphGeneration(): number {
  return generation;
}

/**
 * Subscribe to glyph availability. Fires after a batch of deferred SDF bakes
 * completes, and when an atlas or outline face finishes loading — text that
 * painted nothing (or painted from a lower tier) can now paint. Also fires
 * when such a load fails, since text laid out while it was pending is stale
 * either way. Returns an unsubscribe.
 */
export function subscribeGlyphReady(cb: () => void): () => void {
  return ready.subscribe(cb);
}

/** Advanced by every `notifyGlyphReady` and by no `notifyGlyphBaked`. */
let faces = 0;

/**
 * How many times the faces themselves have changed: a registration, a load
 * landing or failing, a fallback policy, a canvas face measured again or its
 * pages emptied. Unlike {@link glyphGeneration} it holds still when a deferred
 * bake lands, which fills in an atlas rect and moves no pen — so text measured
 * under one value is still measured right while the value stands. Compare
 * with `!==`.
 */
export function faceGeneration(): number {
  return faces;
}

/** @internal Fired by a glyph source when what it measures or serves changed. */
export function notifyGlyphReady(): void {
  generation++;
  faces++;
  ready.emit();
}

/** @internal Fired when deferred bakes land: glyphs already measured can now
 *  paint, and nothing about their faces changed. */
export function notifyGlyphBaked(): void {
  generation++;
  ready.emit();
}

/** @internal Test seam — the subscriber set is module state. */
export function _clearGlyphReadySubscribers(): void {
  ready = createEmitter();
}
