/**
 * "A glyph the renderer asked for can now paint" — the redraw signal shared
 * by every asynchronous glyph source.
 *
 * Both lazy tiers land their work *after* the frame that asked for it: the
 * dynamic canvas-SDF atlas defers bakes past a per-frame budget, and the
 * outline tier has to fetch and parse font bytes. Neither can paint anything
 * on the frame that first requests a glyph, so both have to tell the canvas
 * to draw again.
 *
 * One subscriber set, not one per tier: a consumer wiring "redraw when text
 * becomes drawable" should not have to know how many tiers exist, or grow a
 * second subscription every time one is added. `<SceneCanvas>` subscribes
 * once and both tiers reach it.
 */

const subscribers = new Set<() => void>();

/** Advanced by every `notifyGlyphReady`, so state can be checked rather than
 *  listened for. See {@link glyphGeneration}. */
let generation = 0;

/**
 * How many times glyph availability has changed — the pull-based companion to
 * {@link subscribeGlyphReady}.
 *
 * For caches that cannot hold a subscription. Subscribing at module load is a
 * side effect that reaches across a package boundary: it makes importing the
 * module that holds the cache require this package's whole surface, so a
 * consumer partially mocking `@weasel-js/font` breaks at import rather than at
 * use, and import order starts to matter. Comparing a counter has neither
 * problem, and costs a field read on a path that was going to check a cache
 * key anyway.
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
 * completes, and when an outline face finishes loading — in both cases, text
 * that painted nothing (or painted from a lower tier) can now paint. Returns
 * an unsubscribe.
 */
export function subscribeGlyphReady(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** @internal Fired by a glyph source once newly-available glyphs can paint. */
export function notifyGlyphReady(): void {
  generation++;
  for (const cb of subscribers) cb();
}

/** @internal Test seam — the subscriber set is module state. */
export function _clearGlyphReadySubscribers(): void {
  subscribers.clear();
}
