# Audit round 34 — apps.draw.src.part2

## Opacity scrub cannot raise a selection whose paints are all at alpha 0, while its HUD reports the rise
- where: apps/draw/src/opacityScrub/computeScrubbedPaints.ts:28 (computeScrubbedPaints); apps/draw/src/opacityScrub/useOpacityScrub.ts:125 (nudge run)
- scenario: select a rect whose fill is `#ff000000` (resolves, so `readSnapshot` keeps it), hold O, wheel up. `targetAlpha` climbs 0 → 0.05 → … and the HUD shows 5%, 10%…, but `brightest === 0` gives `factor = 0`, so every update writes alpha 0 again (and pushes an undo entry that changes nothing). The node never becomes visible. It should set the painted channel(s) to `targetAlpha`, or the session should not open on it.
- evidence: read
- severity: medium

## One wheel notch down raises the opacity of the dimmer nodes in a mixed selection
- where: apps/draw/src/opacityScrub/useOpacityScrub.ts:96-102 (startSession) with computeScrubbedPaints.ts:28
- scenario: select A (fill alpha 1) and B (fill alpha 0.3), hold O, wheel down once. The session's target starts at the brightest across the selection (1) and drops to 0.95; each node is rescaled so its *own* brightest lands on 0.95, so B jumps 0.3 → 0.95. A scrub down makes B far more opaque. The per-node ratio is preserved but the between-node one is not; the factor should be `target / sessionBrightest` applied to every node.
- evidence: read
- severity: medium

## A recording of a two-pointer gesture replays every move as the last-pressed pointer's
- where: apps/draw/src/recorder.ts:195-204 (handlePointer, pointermove branch); apps/draw/src/replay.ts:53-66,130-131 (buildPointerEvent, replayRecording)
- scenario: record a pinch: pointerdown id 1, pointerdown id 2, moves of both, pointerup id 2, more moves of id 1, pointerup id 1. The recorder drops `pointerId` from moves ("they don't change from the matching pointerdown"), but with two pointers down there is no single matching down; replay's `press` is just the latest pointerdown. Every move between the two downs and the first up replays as pointer 2, and after pointer 2 lifts `press` becomes undefined, so pointer 1's remaining moves replay as `pointerId: 1, buttons: 0` hovers. A pinch or two-finger pan replays as something else. Moves should keep `pointerId` (and replay should look up the press by id).
- evidence: read
- severity: medium

## A live path effect inside a frame (a page other than the first, or a non-envelope group) exports at its frame-local coordinates
- where: apps/draw/src/svgExport.ts:102-112 (effectToObj)
- scenario: draw a tween/roughen effect on page 2 of a two-page document (page 2 is a frame at, say, x = 816 + gap). `derivedDepOf(documentOf(scene), d, node)` hands the derivation its sources in the effect's own frame (`depsAsRead` → `depFrameRebase`), so `pathEffectParts` returns paths in page 2's local coordinates. `effectToObj` boxes them at those raw bounds and never composes through the frame above, unlike `booleanToObj` (lines 125-128), which walks up to the nearest `definesFrame` ancestor and composes its world pose. Every other leaf is lowered at `worldPoses(...)`. The effect's paths land near page 1's origin inside page 2's clipped group, so Save writes them off-page (clipped away) and reopening places them wrong; the same for an effect under any rigid group. Should compose like `booleanToObj`.
- evidence: read
- severity: medium

## Copy-as-SVG's viewBox is the selection's geometric box, so strokes and markers at its edges are cut off
- where: apps/draw/src/svgExport.ts:267-278 (selectionToSvgString)
- scenario: select a rect with a 10px stroke and copy (or Export selection); paste into another app. The `viewBox`/`width`/`height` are `unionAabb` of the roots' poses, which bound the geometry only, so the outer 5px of the stroke on every side (and any arrowhead past an endpoint, or a text overhang) is outside the viewBox and clipped. The bounds should be the painted bounds. The box also counts roots the export skips (a node on an annotation or hidden layer, filtered by `isPainted`), leaving empty margin.
- evidence: read
- severity: low

## An SVG whose `wd:leaf-id`/`wd:group-id` already uses an `svg-N` id gets two drafts with one id
- where: apps/draw/src/svgInterop.ts:302-317 (svgNodesToSceneDrafts idOf) with apps/draw/src/openSvg.ts:31
- scenario: a file whose first leaf carries `wd:leaf-id="svg-1"` and whose second leaf carries none. The first takes `svg-1` (added to `used`); the second gets `nextId()` = `svg-1`, which is never checked against `used` (nor added to it for page groups). `addDrafts` keys `sceneIdOf` by draft id, so both drafts map to one minted scene id and the second add collides (or one draft's children reparent under the other). `nextId()` results should be skipped while `used` holds them.
- evidence: read
- severity: low

## A paint edit made while O is held is reverted by the next wheel turn
- where: apps/draw/src/opacityScrub/useOpacityScrub.ts:72-86 (applyLive), with the snapshot taken once in startSession (89-105)
- scenario: hold O, wheel once, then (still holding O) press X to swap fill and stroke, or click a palette swatch, which repaints the selection; wheel again. `applyLive` rebuilds `fill`/`stroke` from the session's press-time `snapshots`, spread over the current data, so the swap or the new color is overwritten by the old paints at the new alpha. The hook's doc says "an edit made in between ends the run, and stays", and the test (`keeps an edit made between two wheel turns`) only covers a pose edit. A paint edit should be re-read (re-snapshot when the node's paints differ from what the last tick wrote), not clobbered.
- evidence: read
- severity: medium

## Detaching the canvas does not stop a replay in flight
- where: apps/draw/src/recording/session.ts:46-55 (attach teardown) and 74-95 (play); apps/draw/src/replay.ts:110-135 (replayRecording has no abort)
- scenario: start Play on a long realtime recording, then unmount the canvas (or remount it, e.g. a surface change that re-runs the contribution's `attach`). The teardown stops a *recording* but nothing reaches the replay: its `after`-paced loop keeps dispatching synthetic pointer and key events at the old canvas element (and keys at `document`, which the live app still hears), and `playing` stays true on the session, so after remount Record and Play stay disabled until the old replay runs out. The teardown should abort the replay (an `AbortSignal` through `ReplayOptions`) and clear `playing`.
- evidence: read
- severity: low

## Files read
apps/draw/src/opacityScrub/OpacityHud.module.css
apps/draw/src/opacityScrub/OpacityHud.tsx
apps/draw/src/opacityScrub/computeScrubbedPaints.ts
apps/draw/src/opacityScrub/useOpacityScrub.ts
apps/draw/src/openSession.ts
apps/draw/src/openSvg.ts
apps/draw/src/outlinesAdapter.ts
apps/draw/src/page.css
apps/draw/src/pageLayers.ts
apps/draw/src/pages/DrawPageStrip.tsx
apps/draw/src/pages/drawPages.ts
apps/draw/src/pages/pageCommands.ts
apps/draw/src/pages/pageStrip.css
apps/draw/src/paintRenderers.tsx
apps/draw/src/paperSizes.ts
apps/draw/src/pasteOmissions.ts
apps/draw/src/persistence.ts
apps/draw/src/prefs.ts
apps/draw/src/recorder.ts
apps/draw/src/recording/contribution.tsx
apps/draw/src/recording/depSchemaAugmentation.ts
apps/draw/src/recording/session.ts
apps/draw/src/recording/useRecording.ts
apps/draw/src/recordingIO.ts
apps/draw/src/registry/RegistrySelect.tsx
apps/draw/src/registry/toolEnumSource.ts
apps/draw/src/registry/types.ts
apps/draw/src/releaseCompound.ts
apps/draw/src/replay.ts
apps/draw/src/saveSvg.ts
apps/draw/src/sceneLoading.ts
apps/draw/src/sessionRecords.ts
apps/draw/src/sidebarPanels.tsx
apps/draw/src/svgCorners.ts
apps/draw/src/svgEffects.ts
apps/draw/src/svgExport.ts
apps/draw/src/svgImport.ts
apps/draw/src/svgInterop.ts

<!-- done: 8 findings, files read: 38 -->
