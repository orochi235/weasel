# Audit round 34 — apps.draw.src.part2

## Opacity scrub cannot raise a fully transparent selection: the HUD climbs while the paints stay at 0
- where: apps/draw/src/opacityScrub/computeScrubbedPaints.ts:28 (computeScrubbedPaints), with apps/draw/src/opacityScrub/useOpacityScrub.ts:89-104 (startSession) and :119-128 (nudge run)
- scenario: scrub a shape down to 0% and release O (the session commits at alpha 0). Hold O again: `readSnapshot` still accepts the node because its fill/stroke resolve, so `sessionBrightest` is 0. Every wheel notch raises `session.targetAlpha` (HUD shows 5%, 10%, …), but `computeScrubbedPaints` computes `factor = brightest === 0 ? 0 : …`, so each tick writes alpha 0 back. The shape can never be scrubbed back up, and the HUD reports an opacity the shape does not have. The same happens for any shape whose fill and stroke paints are both alpha 0. Expected: with a zero-alpha snapshot, the paints take `targetAlpha` directly (or the session refuses to open).
- evidence: read
- severity: medium

## Opacity scrub writes the session-start fill and stroke back on every tick, undoing an edit made between ticks
- where: apps/draw/src/opacityScrub/useOpacityScrub.ts:72-86 (applyLive)
- scenario: hold O over a selection with a red fill and blue stroke, turn the wheel once, then (O still held) change the paint by another path, for example draw's swap-fill/stroke key X or a swatch click, which the doc comment says "ends the run, and stays". Turn the wheel again: `applyLive` computes from `session.snapshots`, which was taken in `startSession`, and overwrites `fill`/`stroke` with the snapshot's paints at the new alpha. The swap or the new color is silently reverted (in a new undo entry, since the coalesce run was broken). Expected: the in-between edit stays, so either re-snapshot when the run is interrupted or scale the node's current paints.
- evidence: read
- severity: low

## A recording loses which pointer each move belongs to, so a multi-pointer gesture replays wrong
- where: apps/draw/src/recorder.ts:195-204 (handlePointer, pointermove branch), with apps/draw/src/replay.ts:53-67 (buildPointerEvent) and :130-131 (press tracking)
- scenario: record a two-finger pinch or any two-pointer gesture on the canvas. Pointer moves are stored without `pointerId`, `buttons` or `pointerType` ("don't change from the matching pointerdown"), but with two pointers down the move cannot be matched to its press. On replay, `press` is only the latest pointerdown, so every move from both fingers is dispatched with the second finger's `pointerId`. Once the second finger lifts, `press` becomes `undefined` and the first finger's remaining moves replay with `pointerId: 1`, `buttons: 0`: as hovers by a pointer that was never pressed. Expected: a move keeps its `pointerId` (at least when more than one pointer is down), and replay looks the press up by that id.
- evidence: read
- severity: medium

## SVG import can give two nodes the same id when a file's `wd:leaf-id`s look like the importer's minted ids
- where: apps/draw/src/svgInterop.ts:302-316 (svgNodesToSceneDrafts, idOf), with apps/draw/src/openSvg.ts:30-31 (parseDrafts nextId)
- scenario: `idOf` checks a carried id against `used`, but never checks a freshly minted `nextId()` id against it, and the page group's minted id is never added to `used`. A file whose first leaf has no `wd:leaf-id` and whose second carries `wd:leaf-id="svg-2"` works; a third id-less leaf then mints `svg-2` too. In `addDrafts`, `sceneIdOf` is a Map keyed on draft id, so both drafts get the same scene id and the second spec collides with the first. Likewise a carried id equal to a page group's minted id is dropped by `if (pageOfGroup.has(d.id)) return []`, taking the leaf with it. Expected: minting skips ids in `used`, and page ids are added to it.
- evidence: read
- severity: low

## A recording that fails to serialize is dropped with no notice and an unhandled rejection
- where: apps/draw/src/recording/session.ts:66-71 (toggle), apps/draw/src/recording/contribution.tsx:27
- scenario: the stop path calls `recorder.stop()` and then awaits `serializeRecording`. If that throws (`JSON.stringify` on a scene snapshot that holds a BigInt or a cycle, or a `CompressionStream` failure), the rejection escapes `toggle()`, which the action runs as `void read(deps)?.toggle()`. The recording is gone, nothing is downloaded, and `host.failed` is never called, whereas `play` reports its failures through `host.failed`. Expected: the same try/`failed` handling as `play`.
- evidence: read
- severity: low

## Playback cannot be stopped and outlives the canvas it was started on
- where: apps/draw/src/recording/session.ts:46-55 (attach teardown) and :74-95 (play), apps/draw/src/replay.ts:110-135
- scenario: play a recording whose events are far apart. `t` is unvalidated, so a hand-edited or long-idle file can wait for minutes or hours. `replayRecording` takes no abort signal and nothing cancels it, so `playing` stays true and Record and Play stay disabled until it ends. If the canvas unmounts meanwhile, the attach teardown stops only a recording in flight. The replay goes on dispatching synthesized events at the detached `target` element and then calls `host.restore`/`changed` on a session whose canvas is gone. Expected: the teardown, and a second press of Play or Record, abort the replay.
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

<!-- done: 6 findings, files read: 38 -->
