## Changing `highlight` (every devtools tree-row hover) rebuilds the sink and overlay, wiping the frame panel, viewport record and in-flight snap candidates
- where: packages/core/src/debug/useDebugSink.ts:32 (useDebugSink)
- scenario: `useDebugSink` keys its memo on `JSON.stringify(debug)`, and `debug` includes `highlight`. The devtools Elements view sends a `highlight` request on every `pointerover` of a tree row (`devtools/src/views/SceneView.tsx:43-54`), which `attach.ts:68` lays over the canvas's flags as `highlight: [id]` through `useDebugOverride`. Each hover changes the key, so a fresh `createDebugSink` + `createDebugOverlayLayer` is built: the overlay's `fpsHistory` restarts (the fps/frame rows show "—" until two more paints), `snapshot.frame` (last paint's stats), `snapshot.viewport` (the last pan/zoom record, documented to "survive frames until replaced") and the snap candidates are all lost. A snap session that captured the old sink at press keeps recording into a sink nobody draws, so candidates vanish mid-drag. Expected: `highlight` is a per-frame read the overlay already rebuilds a Set for each draw (`createDebugOverlayLayer.ts:82`); changing it should not discard accumulated state. Only the sink's `recordBounds` gate reads it at creation time (`createDebugSink.ts:29`), which is what forces the rebuild.
- evidence: read
- severity: medium

## A `theme`/`strokes` entry set to `undefined` overrides the default; an undefined stroke throws and drops the whole overlay
- where: packages/core/src/debug/createDebugOverlayLayer.ts:73-74 (buildDebugOverlayCommands), :139 (strokeOf)
- scenario: `DebugFlags.strokes` is `Partial<DebugStrokes>` and the repo does not enable `exactOptionalPropertyTypes`, so `{ hitboxes: true, strokes: { hitbox: someCondition ? custom : undefined } }` type-checks. `{ ...DEFAULT_DEBUG_STROKES, ...config.strokes }` copies the `undefined` over the default, then `strokeOf(strokes.hitbox, …)` reads `s.width` on `undefined` and throws; `drawLayers` drops the debug layer for the frame (every frame). Same for `theme: { handle: undefined }` → stroke paint `color: undefined`. The canvas path happens to survive because `useDebugSink` round-trips the config through JSON (which strips undefined), but `buildDebugOverlayCommands` is public and `renderDebugSnapshot` calls it with the caller's config directly. Expected: an absent-or-undefined override falls back to the default.
- evidence: read
- severity: low

## Frame-rate readout averages over the last 60 paints regardless of age, so after any idle spell it reports a fraction of the real rate
- where: packages/core/src/debug/createDebugOverlayLayer.ts:47-49 (createDebugOverlayLayer draw) with packages/core/src/debug/overlayPanels.ts:60-61 (emitFramePanel)
- scenario: the canvas paints on demand. Sit idle 10 s, then start a drag that repaints at 60 Hz: `fpsHistory` still holds the stamps from before the idle gap, so `interval = (last − first) / 59` spans the 10 s pause and the panel reads ≈ 6 fps / 170 ms for the next ~59 frames (about a second of a 60 Hz drag), recovering only once every pre-gap stamp has shifted out. A backgrounded tab returning gives the same, with the gap as long as the tab was hidden. Expected: the rate describes the current repaint cadence (drop stamps older than a time window, or restart the history when the gap between paints exceeds a bound).
- evidence: read
- severity: low

## Id labels are placed 11 px below the bounds' top edge, as if `y` were a baseline, but text commands are top-anchored
- where: packages/core/src/debug/createDebugOverlayLayer.ts:294-299 (emitIds)
- scenario: `textCommandFromRuns(sx + 2, sy + 11, …, { fontSize: 10 })`. `TextDrawCommand.y` is the top of the block (default `verticalAlign` 'top'; the overlay's own panels place text at `y + PAD_Y`, `overlayPanels.ts:42`). So the 10 px label's top sits 11 px below the node's top edge — a full line down — and for any node under ~21 px tall it paints below the bounds entirely, onto whatever is under it, rather than "at the top-left of its bounds" as `DebugFlags.ids` documents. The offset dates from the feature's first commit (16b6b80399) and reads as a canvas2D baseline offset. Expected: `sy + 1`-ish (a small top padding).
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

<!-- done: 4 findings, files read: 12 -->
