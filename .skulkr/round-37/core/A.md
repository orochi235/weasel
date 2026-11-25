# Audit round 37 — core — findings

## Paint ignores `region.chromeId`, so a region hidden by chrome-caps is still drawn while it cannot be hit
- where: packages/core/src/affordances/composeAffordanceLayer.ts:65-72 (composeAffordanceLayer `draw`)
- scenario: an affordance region carries `chromeId: 'x'` (e.g. a path-edit extension part with its own chrome id, pathAnchors.ts:210) and a `paint`; chrome caps hide `'x'` but show the affordance. `hitAffordanceRegions` skips the region (hitAffordanceRegions.ts:61) but `draw` only checks `isVisible(a.id)` and paints it anyway — visible chrome that cannot be pressed. hitAffordanceRegions' doc says the gate is "the same chrome id used at paint time, so chrome that isn't drawn can't be hit". `draw` should also skip when `region.chromeId && !isVisible(region.chromeId)`.
- evidence: read
- severity: medium

## Annulus paint centers the inner cutout on (cx, cy); hit-test uses innerX/innerY
- where: packages/core/src/affordances/composeAffordanceLayer.ts:261-272 (annulusCommand) vs packages/core/src/affordances/hitAffordanceRegions.ts:241-244 (hitRegion)
- scenario: an annulus shape whose inner rect is not centered on the ellipse center (`innerX !== cx - innerWidth/2`; the type gives the two independently) paints its petals around a rect centered at (cx, cy) of size innerWidth×innerHeight, while the hit test cuts out `[innerX, innerX+innerWidth] × [innerY, innerY+innerHeight]`. The visible ring and the grabbable ring differ (paint covers part of the real cutout on one side, leaves an unpainted live band on the other). `annulusSemiAxes` likewise floors rx/ry from `innerWidth/2` around cx, not from the actual inner rect's extent.
- evidence: read
- severity: low

## Escape-returns-to-default bypasses the mode gate that tool keys obey
- where: packages/core/src/tools/useKeybindings.ts:104-112 (useKeybindings, reset-to-default resolver)
- scenario: `modes` is passed and the active mode does not allow the default tool's `eligibility.capabilities` (the palette greys it out). Pressing its letter key is refused (line 91-94), but pressing Escape activates it anyway, since the reset resolver checks only `api.has(target)` and `api.active`. The hook's doc promises "a key cannot reach a tool the palette greys out". The resolver should apply the same `eligibleForMode` check and return null when it fails.
- evidence: read
- severity: medium

## `useKeyState({ target })` never attaches when the element mounts after the effect, or re-attaches when it changes
- where: packages/core/src/input/useKeyState.ts:18-25 (useKeyState)
- scenario: the effect reads `target.current` once and depends on the ref object, which never changes identity. A host rendered conditionally (`{ready && <div ref={host} />}`), or one in a child that mounts after this component's effect, gives `null` at effect time → `return` with nothing attached, and the poll reports no keys for the component's life. Likewise, when the ref's element is swapped (keyed remount), the listeners stay on the detached old element and the new one is never heard. `useKeyModifiers` inherits both. Expected: attach to whatever element the ref holds once it holds one (callback ref or re-check on element change).
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

Note: icons.gen.ts was read only in part (header, the start of the name union, the `icon`/`ICON_GROUPS`/module-augmentation declarations, and its tail); a check of the name union against icons.table.json and the augmentation was not run.

<!-- done: 4 findings, files read: 35 -->
