# Audit round 38 — area `core` — findings

## composeAffordanceLayer paints a region whose own `chromeId` is hidden, while the hit test refuses it
- where: packages/core/src/affordances/composeAffordanceLayer.ts:65-72 (composeAffordanceLayer `draw`)
- scenario: An affordance region sets `chromeId: 'x'` (`AffordanceRegion.chromeId`, "gating this region on top of its affordance's") and a `paint`. Chrome caps hide `'x'` but not the affordance. `hitAffordanceRegions` (hitAffordanceRegions.ts:61) skips the region. `draw` checks only `isVisible(a.id)` and never `region.chromeId`, so it paints a handle that no press can reach. The same visibility decision is answered two ways, and `hitAffordanceRegions`' doc promise ("chrome that isn't drawn can't be hit either") breaks in the other direction. Expected: `draw` also skips a region when `region.chromeId && !isVisible(region.chromeId)`.
- evidence: read
- severity: medium

## Escape returns to a default tool the active mode forbids, though tool keys are gated on the mode
- where: packages/core/src/tools/useKeybindings.ts:104-112 (useKeybindings, the `createToolResetToDefaultAction` target)
- scenario: `useKeybindings(tools, { modes })` gates `tool.activate` with `eligibleForMode(modes.current(), capabilities)`, and its doc says "a key cannot reach a tool the palette greys out". The Escape target, `defaultTool ?? initialActiveRef.current`, is only checked with `api.has(target)` and `api.active !== target`. Take a canvas whose initial tool is `select`. It enters a mode whose capabilities exclude `select`, and the mode's own `defaultTool` (say `hand`) becomes active through `UseToolsOptions.modes`. Pressing Escape runs `setActive('select')`. A key activates a tool the palette shows greyed out, and the user leaves the mode's default tool. Expected: the Escape target goes through the same `modes` predicate and returns `null` when it fails, so Escape falls through (or Escape targets the mode's `defaultTool`).
- evidence: read
- severity: medium

## An annulus whose inner rect isn't centered on (cx, cy) is painted and floored around a different cutout than the one it hit-tests
- where: packages/core/src/affordances/composeAffordanceLayer.ts:263-265 (annulusCommand); packages/core/src/affordances/hitAffordanceRegions.ts:203-204 (annulusSemiAxes) vs 241-243 (hitRegion)
- scenario: The annulus shape carries its inner rect as `innerX/innerY/innerWidth/innerHeight`, separate from the ellipse center `cx/cy`. The hit test cuts out exactly `[innerX, innerX+innerWidth] × [innerY, innerY+innerHeight]`. Paint and the `minBandPx` floor ignore `innerX/innerY` and assume the rect spans `cx ± innerWidth/2, cy ± innerHeight/2`. With `cx=0, innerX=0, innerWidth=100`, the painted ring cuts out x∈[-50, 50] but the hit test cuts out x∈[0, 100]. So the strip x∈[-50, 0] is grabbable but not painted, and x∈[50, 100] is painted as ring but not grabbable. Expected: one cutout for both, with paint and the floor reading the rect's real edges, or the type deriving those edges from the center.
- evidence: read
- severity: low

## Overlapping point regions are ranked by world distance, not screen distance, under non-uniform zoom
- where: packages/core/src/affordances/hitAffordanceRegions.ts:86-103 (regionDistance2)
- scenario: Point regions' hit squares are sized and tested in screen pixels (`hitRegion` scales the delta by `view.scale`). When several regions contain the press, though, the "nearest" one is picked by unscaled world distance. Take `view.scale = {x: 1, y: 8}` and two corner handles of a small selection that both contain the press. One is 3 world units away along x (3 px on screen), the other 1 world unit away along y (8 px on screen). The press goes to the handle that is 8 px away on screen, not the one 3 px away. Expected: rank by `scaleDelta(dx, dy, view.scale)`, the space the hit squares are tested in.
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

(The write to `.skulk/out/findings.md` was refused twice for lack of permission, so the document is here instead. I also couldn't run `git log`, which needed approval, so I didn't single out last week's changes.)

<!-- done: 4 findings, files read: 35 -->