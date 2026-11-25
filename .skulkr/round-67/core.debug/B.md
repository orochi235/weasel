# Audit round 67 — core.debug

## A highlight from a discarded render sticks, because `useDebugSink` writes it into the live config inside `useMemo`
- where: packages/core/src/debug/useDebugSink.ts:47-51 (useDebugSink, the `state` memo calling `base.setHighlight`)
- scenario: an inspector's hover renders a canvas with `highlight: ['b']` (previously `['a']`) in a render React then throws away (a `startTransition` interrupted by an urgent update, or a suspended sibling). The memo already ran `setHighlight(['b'])`, which mutated the shared `live` config. The next render that commits still has `highlightKey` for `['a']`, so React compares it with the last *committed* deps (`['a']`), finds them equal, and returns the cached `state` without calling `setHighlight` again. `live.highlight` stays `['b']`, and the overlay (`emitHighlight` reads `config.highlight`) and the sink (`isHighlighted`) outline node `b` until the highlight changes again. They should show the committed `['a']`. The mutation should happen in a (layout) effect, or the highlight should be passed in fresh each render.
- evidence: read
- severity: low

## `ids` labels land outside the node's box on a y-up (or x-flipped) view
- where: packages/core/src/debug/createDebugOverlayLayer.ts:295-302 (emitIds)
- scenario: a view with `scale.y < 0` (a y-up canvas, which `renderDebugSnapshot` explicitly supports per core CHANGELOG 87dd1ad). `worldToScreen(b.bounds.x, b.bounds.y)` is the screen point of the bounds' world-min corner, which on a y-up view is the box's *bottom* edge on screen. The label is drawn at `(sx + 2, sy + 1)` going down, so it sits below the box, under the next node, not "at the top-left of its bounds" as `DebugFlags.ids` documents. With `scale.x < 0` the same thing happens horizontally. The fix is to anchor at `min`/`max` of the projected corners. The rect emitters tolerate negative extents, since the renderer normalizes rects, but this one positions text from a single corner.
- evidence: read
- severity: low

## An override toggling between "shows something" and "shows nothing" rebuilds the debug sink and overlay each time
- where: packages/core/src/debug/override.ts:16-19 (withOverride), packages/core/src/debug/useDebugSink.ts:34-46 (key)
- scenario: a canvas with `debug` undefined and no `?debug=` in the URL, under an inspector that sets `setOverride({ highlight: [id] })` on hover and `setOverride(null)` on leave. While hovered, `withOverride` returns `{ highlight }`, and `useDebugSink`'s key is `'{}'`. On leave it returns `undefined`, so the key becomes `undefined`. Each hover-in therefore creates a new sink and a new overlay `RenderLayer` (a new object in the layer stack). That drops the frame-rate history, the last `frame` stats and the recorded `viewport`, and changes the layer list the canvas paints. `useDebugSink`'s own doc says highlight is kept out of the key precisely so hover does not replace the sink. The `undefined`↔config flip goes around that, because `withOverride` returns the bare `debug` rather than an equivalent off config.
- evidence: read
- severity: low

## Files read
packages/core/src/debug/createDebugOverlayLayer.ts
packages/core/src/debug/createDebugSink.ts
packages/core/src/debug/defaultTheme.ts
packages/core/src/debug/features.ts
packages/core/src/debug/flag.ts
packages/core/src/debug/frameStats.ts
packages/core/src/debug/index.ts
packages/core/src/debug/overlayPanels.ts
packages/core/src/debug/override.ts
packages/core/src/debug/parseDebugFlags.ts
packages/core/src/debug/types.ts
packages/core/src/debug/useDebugSink.ts

<!-- done: 3 findings, files read: 12 -->
