# Audit round 38 — core — findings

## composeAffordanceLayer paints a region its own `chromeId` hides, while the hit walk skips it
- where: packages/core/src/affordances/composeAffordanceLayer.ts:67 (composeAffordanceLayer → draw)
- scenario: an affordance with a painted region carrying `chromeId: 'x'`, and chrome caps with `isVisible('x') === false` (affordance id visible). `draw` gates only on `a.id`, so the region is still painted (and its debug hitbox recorded); `hitAffordanceRegions` (hitAffordanceRegions.ts:61) skips it, so the user sees a handle that can't be pressed. `AffordanceRegion.chromeId` is documented as "gating this region on top of its affordance's" — both paths should apply it.
- evidence: read
- severity: medium

## Annulus paint's petals wind in opposite directions, so where two overlap the nonzero fill leaves a hole and a stroke draws a chord across the ring
- where: packages/core/src/affordances/composeAffordanceLayer.ts:292 (annulusCommand)
- scenario: the four petals overlap in the corner wedges whenever the inner rect's corner lies inside the (inset) ellipse, i.e. `(rectHW/rx)² + (rectHH/ry)² < 1`. The top and left petals are traced with `t` decreasing (negative orientation), the bottom and right with `t` increasing (positive), and the path is `fillRule: 'nonzero'`, which the renderer honors by winding count (geom tessellate/crossings). So the top-right and bottom-left wedges sum to winding 0 and go unfilled, while bottom-right and top-left reach ±2. With `createRotationAffordance({ paint: <bare stroke> })` (no inset; editing rotationHandle.ts:76) on a 20×20 px selection, `minBandPx` 24 makes rx = ry = 34 against a 10 px half-rect: the corners are well inside, and the stroke draws each petal's closing chord straight through its neighbour, as lines crossing the ring past the box corners; `{ fill, insetPx: 0 }` shows two diagonal corner holes. The comment's "the visible fill is true ellipse minus rect" holds only while the corners sit outside the ellipse (the default 10 px inset happens to keep them there).
- evidence: read
- severity: medium

## Annulus paint assumes the inner rect is centered on (cx, cy); the hit test uses its real position
- where: packages/core/src/affordances/composeAffordanceLayer.ts:264 (annulusCommand) vs packages/core/src/affordances/hitAffordanceRegions.ts:241 (hitRegion)
- scenario: an annulus region whose `innerX/innerY` do not center the cutout on `cx/cy` (the type allows it; nothing documents the constraint). Paint builds its cutout as `cx ± innerWidth/2`, `cy ± innerHeight/2`, ignoring `innerX/innerY`, while `hitRegion` cuts out `[innerX, innerX+innerWidth] × [innerY, innerY+innerHeight]`, so the painted ring and the pressable ring differ, which the `annulusSemiAxes` doc says must not happen. `annulusSemiAxes` makes the same centered assumption for its `minBandPx` floor.
- evidence: read
- severity: low

## A KeyState attached to two targets loses its window-blur release when either detaches
- where: packages/core/src/input/keyState.ts:170 (createKeyState → attach)
- scenario: `attach` registers the one shared `release` function as the window `blur` listener on every call. `addEventListener` dedupes an identical listener, so `ks.attach(canvasA)` then `ks.attach(canvasB)` holds one blur registration, and `detachA()` removes it (line 178) while B is still attached. After that, alt-tabbing away with a key held never releases it through blur, and `isDown` stays true until a keyup that may never arrive, the stale-key case the attach doc promises to handle. The interface does not limit a KeyState to one attachment. (detachA's unconditional `release()` also clears keys B is still tracking.) Each attach should register a listener of its own.
- evidence: read
- severity: low

## usePublishPointer keeps a stale position when a drag ends off-window and the release is never seen
- where: packages/core/src/input/usePublishPointer.ts:53 (onDocMove)
- scenario: press on the canvas, drag off the browser window, release there (no capture, so no pointerup reaches the document), and move back in over other UI. `heldPointers` drops the press on the first `buttons === 0` move ("the release this document never saw"), and then `onDocMove` sees `held.count() === 0` and returns without clearing. The store goes on reporting the last off-element drag point for this view until the pointer next enters and leaves the element, though the doc says a pointer released outside clears the store. Clearing when the held count drops to 0 outside the element (e.g. `held.subscribe`) covers both release paths.
- evidence: read
- severity: low

## composeAffordanceLayer's hit drops the region's `hitKind`, so the documented "Custom affordances" example's `handle:` predicate never matches
- where: packages/core/src/affordances/composeAffordanceLayer.ts:81 (hitTest); example at docs/extending.md:297-313
- scenario: following docs/extending.md, compose `createCornerResizeAffordance()` into a tool overlay and bind `{ kind: 'drag', target: { kindOf: hitPredicate(hit => hit?.kind?.startsWith('handle:')) } }`. The layer's `hitTest` returns only `{ ...binding, cursor, strength, claimedKinds }`; the region's `hitKind` (`'handle:top-left'`) is discarded, and `layerAffordance` (canvas/affordanceAt.ts:200) names the hit `layer:my-tool-overlay`. The predicate is always false, so a drag on the corner never reaches `my-tool.resize`. Either the layer hit should carry the region's `hitKind`, or the example has to match `kind === 'layer:my-tool-overlay'` and read the corner from `initialScratch`.
- evidence: read
- severity: medium

## useKeyState with a `target` ref never attaches if the element mounts after the hook's first effect
- where: packages/core/src/input/useKeyState.ts:19 (useKeyState effect)
- scenario: `useKeyState({ target: hostRef })` where the host `<div ref={hostRef}>` renders only once data has loaded. On the first commit `target.current` is null, so the effect returns without attaching. Its deps (`keys`, the ref object, `skipInEditable`, `owned`) never change when the element appears, so the poll stays deaf for the component's lifetime: `isDown` is always false and no error is raised. The same holds when the ref is moved to a different element. Taking an element (state, or a callback ref) instead of reading `.current` once fixes it.
- evidence: read
- severity: low

## Files read
packages/core/src/WeaselProvider.tsx
packages/core/src/affordances/composeAffordanceLayer.ts
packages/core/src/affordances/hitAffordanceRegions.ts
packages/core/src/affordances/index.ts
packages/core/src/affordances/pathAnchors.ts
packages/core/src/affordances/types.ts
packages/core/src/icons.gen.ts
packages/core/src/icons.table.ts
packages/core/src/index.ts
packages/core/src/input/keyState.ts
packages/core/src/input/useKeyModifiers.ts
packages/core/src/input/useKeyState.ts
packages/core/src/input/usePublishPointer.ts
packages/core/src/kitSettings.ts
packages/core/src/kitSettingsSchema.ts
packages/core/src/layout/index.ts
packages/core/src/layout/types.ts
packages/core/src/test-hook/createTestHook.ts
packages/core/src/test-hook/install.ts
packages/core/src/test-hook/types.ts
packages/core/src/test-hook/useTestHook.ts
packages/core/src/testing/BareCanvas.tsx
packages/core/src/testing/canvas.ts
packages/core/src/testing/canvasPixels.ts
packages/core/src/testing/matchMedia.ts
packages/core/src/tools/builtin/hand/createDragPanContribution.ts
packages/core/src/tools/builtin/hand/index.ts
packages/core/src/tools/builtin/hand/useHandTool.ts
packages/core/src/tools/builtin/index.ts
packages/core/src/tools/builtin/marquee.ts
packages/core/src/tools/builtin/throughChrome.ts
packages/core/src/tools/index.ts
packages/core/src/tools/overlayBinding.ts
packages/core/src/tools/useKeybindings.ts
packages/core/src/version.ts

<!-- done: 8 findings, files read: 35 -->
