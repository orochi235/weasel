I couldn't write `.skulk/out/findings.md` because permission was denied, so here is the whole document as the brief allows.

# Audit round 37 — core (blind reviewer)

## composeAffordanceLayer draws a region whose `chromeId` is hidden, but its hit-test skips that region
- where: packages/core/src/affordances/composeAffordanceLayer.ts:65-72 (`draw`) vs packages/core/src/affordances/hitAffordanceRegions.ts:61 (`hitAffordanceRegions`)
- scenario: an affordance has a region with `chromeId: 'x'`, for example a `PathEditExtension` part that names its own `chromeId` (pathAnchors.ts:210). The envelope's `getIsVisible()` returns false for `'x'` and true for the affordance id. `hitTest` skips the region because line 61 checks `region.chromeId`. `draw` only checks `a.id` (line 66), so it paints the region anyway. The user sees a handle that can't be pressed. Both functions should apply the same `chromeId` check: the type doc says it gates "this region on top of its affordance's", and the walk's doc says chrome that isn't drawn can't be hit.
- evidence: read
- severity: medium

## Regions are hit-tested in screen space but ranked by world distance, so non-uniform zoom picks the wrong "nearest" region
- where: packages/core/src/affordances/hitAffordanceRegions.ts:86-103 (`regionDistance2`), used at line 64
- scenario: `view.scale = {x: 10, y: 1}`, anchor-edit mode, anchors A at world (0.7, 0) and B at world (0, 3), hit radius 8 px, press at world (0, 0). On screen A is 7 px away and B is 3 px away, and both hit squares (tested in screen space, line 225) contain the press. Ranking uses unscaled world d² (A 0.49, B 9), so A wins even though B is the nearer handle on screen. The ranking should scale the deltas by `view.scale`, the same way `hitRegion` does.
- evidence: read
- severity: low

## The annulus fill assumes the inner rect is centered on `(cx, cy)`, but the hit-test uses `innerX/innerY`
- where: packages/core/src/affordances/composeAffordanceLayer.ts:264-272 (`annulusCommand`), packages/core/src/affordances/hitAffordanceRegions.ts:203-204 (`annulusSemiAxes`) vs hitAffordanceRegions.ts:241-243 (`hitRegion`)
- scenario: a consumer affordance declares an annulus whose inner rect is not centered on the ellipse (the shape type allows `innerX/innerY` and `cx/cy` independently). The hit-test cuts out the real rect at `innerX..innerX+innerWidth`. The fill (and the `minBandPx` clamp) cut out a rect of the same size centered on `(cx, cy)`. The visible ring and the ring you can grab then differ, though the code's comment says they match. The kit's own rotation band is centered, so only custom affordances hit this.
- evidence: read
- severity: low

## The middle-button pan doesn't pan with a modifier held, or over chrome that claims the press exclusively
- where: packages/core/src/tools/builtin/hand/createDragPanContribution.ts:16 (`panEntry`)
- scenario: the `view` preset installs `createMiddleDragPanContribution()` as "pans the view on a middle-button drag, under any tool". Its spec has no `mods`, and a spec without `mods` matches only an unmodified input. So a middle-drag with Shift, Alt or Cmd held does nothing. It also has no `target`, so over a consumer layer whose hit is `strength: 'exclusive'` the middle pan is barred. The hand tool's binding guards against both cases (`mods: ANY_MODS`, `target: THROUGH_CHROME`), so "does a held key or chrome stop a pan" gets two different answers.
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
packages/core/src/tools/builtin/hand/useHandTool.ts
packages/core/src/tools/builtin/index.ts
packages/core/src/tools/builtin/marquee.ts
packages/core/src/tools/builtin/throughChrome.ts
packages/core/src/tools/index.ts
packages/core/src/tools/overlayBinding.ts
packages/core/src/tools/useKeybindings.ts
packages/core/src/version.ts

I didn't open `layout/index.ts` or `tools/builtin/hand/index.ts` (one-line re-export files). The `git log` call for last week's changes was denied, so I read the files without that history.

<!-- done: 4 findings, files read: 33 -->