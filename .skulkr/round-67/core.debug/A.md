# Audit round 67 — core.debug

## `ids` labels land outside their node's box under a flipped (y-up) view
- where: packages/core/src/debug/createDebugOverlayLayer.ts:296 (emitIds)
- scenario: a view with `scale.y < 0` (a y-up axis, which `clampView` and `fitViewToBounds` both support) and `debug={{ ids: true, bounds: true }}`. The label goes at `worldToScreen(b.x, b.y) + (2, 1)`. With a negative y scale, world `(x, y)` is the box's screen *bottom*-left, so every id is drawn just below its box, over whatever is under it, rather than at the box's top-left corner as `DebugFlags.ids` documents. The label should anchor at the screen-space top-left: `min(sy, sy + height·scale.y)`, and the same for x when `scale.x < 0`. The same file already handles a negative scale for circle hitboxes (`Math.abs(view.scale.x)` at :171), so the two emitters answer the flipped-axis question differently.
- evidence: read
- severity: low

## Hover highlight can stick at the value from a render React threw away
- where: packages/core/src/debug/useDebugSink.ts:47-51 (useDebugSink, `state` memo)
- scenario: the second `useMemo` calls `base.setHighlight(...)`, which writes `live.highlight` (the config object shared with the sink and the overlay) while rendering. Under concurrent rendering (a transition, a suspended sibling, or a StrictMode double render that gets discarded), a render with `highlight=['b']` writes `live.highlight = ['b']` and is then thrown away. The committed fiber still holds its memo for the old `highlightKey` (`['a']`). The next committed render with `['a']` hits that memo and never calls `setHighlight` again. So `live.highlight` stays `['b']`: the overlay outlines `b`, and `createDebugSink` records bounds for `b` and not `a`, until the highlight changes again. The write should happen during commit (in an effect or layout effect), or each render should derive its own config, rather than mutating shared state inside `useMemo`.
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

<!-- done: 2 findings, files read: 12 -->
