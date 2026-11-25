## interpolateView drops the anchored (geometric) camera curve for a y-up camera, whose scales are both negative
- where: packages/core/src/core/viewport/interpolateView.ts:17 (axisCurve)
- scenario: a flipped-axis view (`scale.y < 0`, the kit's y-up camera) animates a zoom, e.g. `from = {x:0, y:0, scale:{x:1, y:-1}}` to `to` = `zoomAt(from, {x:400,y:300}, 4)` → the y axis takes the `linear` branch because `!(s0 > 0)`, so scale.y moves linearly and y is lerped independently; the world point under the zoom anchor drifts on screen mid-animation while the x axis holds it fixed, and scale.y does not move by a constant ratio per frame. The comment's reason ("`(s1/s0)^t` is NaN for a negative ratio") only holds for a sign *change*: with both endpoints negative the ratio is positive, and the fixed-point formulas `p = (x1-x0)/(1/s0-1/s1)`, `x = w - p/s` hold for any nonzero same-signed scales. The guard should be `s0 * s1 > 0` (same sign), not both positive.
- evidence: read
- severity: medium

## fitZoom / fitSize / useFitOnce default to an unbounded zoom, unlike every other zoom path's DEFAULT_MIN_ZOOM / DEFAULT_MAX_ZOOM
- where: packages/core/src/core/viewport/fitSize.ts:26 (fitZoom)
- scenario: `fitSize(800, 600, 10, 10)` (or `useFitOnce` on small content, which passes `clamp: undefined`) → zoom 51 (or 0.0001-ish for huge content), since `min`/`max` default to ±Infinity. `zoomBounds.ts` states every zoom path defaults from the kit clamp precisely so "a fit could [not] legally land at 10x and the next pinch frame would clamp it back to 8x"; `fitViewToBounds` does default to it. After `useFitOnce` lands at 51x, the first wheel zoom-in (`zoomAt` clamps to 8) snaps the view out to 8x. Should default `min`/`max` to `DEFAULT_MIN_ZOOM`/`DEFAULT_MAX_ZOOM` like `fitViewToBounds`.
- evidence: read
- severity: low

## sceneNodeClientRect projects through the pan/zoom form, losing precision far from the origin
- where: packages/core/src/core/viewport/sceneNodeClientRect.ts:37 (sceneNodeClientRect)
- scenario: node at world x ≈ 1e13 viewed at zoom 8 (view.x ≈ 1e13) → `viewToTransform` gives `panX = -view.x*8 ≈ -8e13`, and `worldToScreen` computes `panX + worldX*8`, two ~8e13 values whose ULP is ~0.016 px; at 1e15 the error is ~1 px and grows linearly, so a Callout anchored to the node lands off it. geom's `viewWorldToScreen` computes `(p.x - view.x) * scale`, which subtracts first and is exact to the screen-sized difference; this path answers the same projection a second, less precise way.
- evidence: read
- severity: low

## useNodeOverlayFrame's view matrix has the same far-from-origin cancellation
- where: packages/core/src/core/viewport/useNodeOverlayFrame.ts:137 (viewMatrix)
- scenario: overlay pinned to a node near world 1e13 at zoom 8 → the matrix's translation `-view.x * sx` (~-8e13) is added to `sx * x` (~8e13) in `transformPoint`, so `toScreen`/`toLocal` jitter by fractions of a pixel growing to whole pixels further out, while the canvas (which projects with `(p - view) * scale`) draws the node steady; the overlay visibly drifts from what it is pinned to. Subtracting the view origin from the frame's translation before scaling (compose in view-relative coordinates) avoids it.
- evidence: read
- severity: low

## useNodeOverlayFrame's toScreen and toLocal disagree once the node's frame goes away
- where: packages/core/src/core/viewport/useNodeOverlayFrame.ts:85 (toScreen)
- scenario: a consumer holds the frame's `toScreen`/`toLocal` (e.g. in a rAF-driven overlay) and the node is deleted or the live view flattens an axis → `project()` returns null; `toLocal` keeps mapping through `lastInverse` (the documented behavior), but `toScreen` returns its input unchanged, treating node-box coords as overlay pixels. The two callbacks handed out together are then no longer inverses: a point round-tripped `toScreen(toLocal(p))` comes back as a node-box point, and the overlay is drawn at world-unit positions. `toScreen` should keep the last forward mapping as `toLocal` keeps the last inverse.
- evidence: read
- severity: low

## Files read
packages/core/src/core/viewport/clampView.ts
packages/core/src/core/viewport/clientToWorld.ts
packages/core/src/core/viewport/createVelocityTracker.ts
packages/core/src/core/viewport/fitSize.ts
packages/core/src/core/viewport/fitViewToBounds.ts
packages/core/src/core/viewport/homeView.ts
packages/core/src/core/viewport/interpolateView.ts
packages/core/src/core/viewport/parallax.ts
packages/core/src/core/viewport/sceneNodeClientRect.ts
packages/core/src/core/viewport/screenSlop.ts
packages/core/src/core/viewport/useCanvasSize.ts
packages/core/src/core/viewport/useDecayLoop.ts
packages/core/src/core/viewport/useFitOnce.ts
packages/core/src/core/viewport/useNodeOverlayFrame.ts
packages/core/src/core/viewport/useVelocityTracker.ts
packages/core/src/core/viewport/useViewAnimation.ts
packages/core/src/core/viewport/view.ts
packages/core/src/core/viewport/viewTransform.ts
packages/core/src/core/viewport/viewportWorldRect.ts
packages/core/src/core/viewport/wheelHandler.ts
packages/core/src/core/viewport/zoomAt.ts
packages/core/src/core/viewport/zoomBounds.ts

<!-- done: 5 findings, files read: 22 -->
