# Findings: ui.components.Timeline

## A dope-sheet key drag still commits after the timeline turns read-only or disabled mid-drag; a graph-mode drag refuses
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:93 (onKeyPointerDown, session `onEnd`)
- scenario: a drag starts on a dope-sheet key while the timeline is editable. Before release, the consumer sets `readOnly` (or `disabled`, or a scope holds it). `drags` is read only at press, and the session's `onEnd` calls the press-time `onKeyChange`. That is `bindLaneEdits`'s closure, which has no hold check, so `onChange` fires with the moved key. The same drag in graph mode reads the current `edits` in `LaneGraph.onLayerCommit` and refuses the commit. So the "is this edit allowed" question gets answered two ways. Expected: a hold that lands mid-drag cancels or refuses the dope drag, as graph mode does.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/Lane.tsx
- size: function
- cause: `drags` sampled at press only
- confidence: likely

## A dope-sheet drag commits against the press-time tracks and reverts any change made to them during the drag; graph mode commits against the current tracks
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:93 (onKeyPointerDown; `onKeyChange`/`onRevert` captured at press) via packages/ui/src/components/Timeline/Timeline.tsx:207 (bindLaneEdits)
- scenario: a key drag on a dope lane is in progress, and `tracks` change from outside. Examples: `AnimatedTimeline`'s handle is edited by other code, or the inspector's `renderKeyEditor` commits a value. On release, `moveKey(tracksAtPress, …)` is sent through `onChange`, and on cancel `onRevert` sends `tracksAtPress.slice()` through `onInput`. Either way the outside change is silently undone. `useKeyEditsHeldByPress` names this hazard, but it only blocks arrow and Delete keys on the lanes. Graph mode's `onKeysChange` uses the render's current `tracks`, so the two modes disagree. Expected: the commit applies the move to the current tracks, and the revert restores only the dragged track.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/useKeyDrag.ts
- size: function
- cause: stale press-time closure over `tracks`
- confidence: likely

## A plain click on a dope-sheet key draws drag feedback (dimmed key and ghost) for as long as the button is held
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:76 (onKeyPointerDown, `setDrag` at press)
- scenario: the user presses a key without moving. `setDrag({ keyIndex: i, t: times[i], times })` runs before the drag threshold is passed. `KeyMarks` then sets `data-dragging='true'` (opacity 0.4), and `KeyGhost` renders over the key until release. The code's own comment says "a press that never travels is a click: it selects and moves nothing". Expected: drag state is set only once `traveled` passes the threshold, in `onMove`.
- evidence: read
- severity: low
- size: line
- cause: drag state set before threshold
- confidence: sure

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

<!-- done: 3 findings, files read: 18 -->
