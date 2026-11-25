# Audit round 70 — ui.components.Timeline

## Delete removes a selected key on a row that is no longer drawn (collapsed nested timeline)
- where: packages/ui/src/components/Timeline/Timeline.tsx:109-114 (onRootKeyDown)
- scenario: select a key on a track inside an expanded nested timeline, click that row's disclosure to fold it (focus stays on the disclosure span), press Delete or Backspace. `markedKey` returns `undefined` (the target is no mark), so `target = selection`, whose `trackPath` addresses a track inside the folded timeline; `deleteKey` removes a key the user can no longer see. `markedKey` already refuses a mark "on no row drawn" (returns null), but the fallback to `selection` never checks that the selection's row is in `rows`. Should refuse (or drop the selection) when no drawn row has `selection.trackPath`.
- evidence: read
- severity: medium

## Delete on a stale held selection reports an edit that changed nothing
- where: packages/ui/src/components/Timeline/Timeline.tsx:110-114 (onRootKeyDown); packages/ui/src/components/Timeline/keys.ts:126-138 (deleteKey)
- scenario: uncontrolled selection at `{ trackPath: [0], keyIndex: 2 }`; the consumer replaces `tracks` so track 0 has two keys (an external undo). Focus on the Graph switch or a disclosure, press Delete: `trackAtPath` is sampled, so `deleteKey` runs, filters nothing out, and `onChange` fires with an unchanged copy (an undo step for nothing), and selection is moved to key 1. The edit protocol says `onChange` never fires "for one that changed nothing". The held selection is never validated against new `tracks`.
- evidence: read
- severity: low

## Keys, segments and nested bars before the window's start draw over the label column
- where: packages/ui/src/components/Timeline/Lane.tsx:80,207-211 (pct, NestedBar); packages/ui/src/components/Timeline/Timeline.module.css:41-46 (.laneTrack)
- scenario: zoom the ruler to `{ from: 1000, to: 2000 }` on a track with a key at 200 ms. `toPercent` gives `left: -80%`; `.laneTrack` is `position: relative` with no `overflow: hidden`, and nothing up to `.lanes` (which only hides x overflow at its own edges, which include the label column) clips it, so the key mark, the segment running from it, and a `NestedBar` whose `at` is before `win.from` (its width is clamped only at `win.to`) paint over the lane labels and gutter, and stay pressable there (a press on a "label" starts a key drag). Marks outside the window should be clipped or not drawn.
- evidence: read
- severity: medium

## A disabled timeline's ruler swallows page scroll
- where: packages/ui/src/components/Timeline/TimeRuler.tsx:83-89 (onWheel); packages/ui/src/components/Timeline/Timeline.tsx:145
- scenario: `<Timeline disabled>` zoomed in. Timeline passes `onWindowChange={ignore}`, but TimeRuler still computes `next = spanPan(win, …)`, sees it differ from `win`, calls `e.preventDefault()` and hands it to the no-op. The window never moves, so the "at either end the wheel goes back to scrolling the page" exit is never reached: wheel over the ruler neither pans nor scrolls the page, indefinitely. Ctrl+wheel likewise blocks browser zoom for nothing.
- evidence: read
- severity: low

## A dope drag that reorders equal-time keys and ends at its start time leaves the preview reordered with no onChange or onCancel
- where: packages/ui/src/components/Timeline/Timeline.tsx:199-205 (bindLaneEdits onKeyInput/onKeyChange); packages/ui/src/components/Timeline/keys.ts:76-80 (moveKey)
- scenario: keys `[A@500, B@500]`; drag A away and back so it snaps onto 500 (its own time is in `snapTimes`). Each `onKeyInput` preview runs `moveKey`, which places the moved key after equal-time keys, so the last preview is `[B, A]`. On release `onKeyChange` sees `keyTime === 500` and returns: no `onChange`, no revert, no `onCancel`. A caller previewing into its own state keeps `[B, A]` while the committed tracks are `[A, B]`, so key indices (and the selection, which stays on index 0 = B) disagree with what was committed. The no-op release should send `onInput` the tracks it began from (as cancel does).
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Timeline/AnimatedTimeline.tsx
packages/ui/src/components/Timeline/Lane.tsx
packages/ui/src/components/Timeline/LaneGraph.tsx
packages/ui/src/components/Timeline/LaneMarks.tsx
packages/ui/src/components/Timeline/TimeRuler.stories.module.css
packages/ui/src/components/Timeline/TimeRuler.stories.tsx
packages/ui/src/components/Timeline/TimeRuler.tsx
packages/ui/src/components/Timeline/Timeline.module.css
packages/ui/src/components/Timeline/Timeline.stories.module.css
packages/ui/src/components/Timeline/Timeline.stories.tsx
packages/ui/src/components/Timeline/Timeline.tsx
packages/ui/src/components/Timeline/TimelineInspector.tsx
packages/ui/src/components/Timeline/index.ts
packages/ui/src/components/Timeline/keys.ts
packages/ui/src/components/Timeline/lanes.ts
packages/ui/src/components/Timeline/timeScale.ts
packages/ui/src/components/Timeline/timelineState.ts
packages/ui/src/components/Timeline/useKeyDrag.ts

<!-- done: 5 findings, files read: 18 -->
