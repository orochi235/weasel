## Two key drags on different lanes at once: the later release overwrites the earlier one's edit
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:68 (onKeyPointerDown)
- scenario: Touch screen, two fingers. Finger 1 presses a key on lane "x", finger 2 presses a key on lane "opacity" (each lane has its own `sessionRef`, so the "belongs to the finger that started it" guard only covers one lane). Both sessions close over the press-time render's `onKeyChange`, which `bindLaneEdits` built over the press-time `tracks`. Finger 1 releases: `commit(moveKey(tracks0, x…))` → onChange(tracks1). Finger 2 releases: `commit(moveKey(tracks0, opacity…))` → onChange(tracks2), built from tracks0, so the "x" move is lost. Expected: both moves survive (or a second simultaneous drag is refused timeline-wide).
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/timelineState.ts
- size: function
- cause: per-lane drag guard; commit against press-time tracks
- confidence: likely

## Graph-mode key drag: the inspector edits the wrong key while a re-sorting preview is echoed
- where: packages/ui/src/components/Timeline/Timeline.tsx:186 (bindLaneEdits onKeysInput)
- scenario: Graph mode, consumer wires `onInput` and echoes it into `tracks`. Drag the selected key at index 1 past the key at index 2. `onKeysInput` sends the re-sorted keys through `onInput` (and `send`), but never calls `report.preview`, unlike the dope path's `onKeyInput`. `useKeyAndSegment` keeps index 1 (the track reads as sent), and `inspected` falls back to `selection`, so `renderKeyEditor` is handed the other key, and a `commit`/`setEasing` from it during the drag writes to that key. The dope path handles the same case through `preview`/`inspected`.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: graph preview bypasses `preview`
- confidence: likely

## Arrow step on a key past the duration moves it to the duration whichever way is pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:171 (markKeys)
- scenario: duration 1000, a key at t=1500 (tracks may hold keys past the duration; they draw with `data-past`). Focus it and press ArrowRight: `to = max(0, min(last=1000, 1510)) = 1000`, `to !== t`, so `onKeyChange(i, 1000)` moves the key 500 ms to the LEFT. A right step should leave it where it is (or move it right), not jump it backward.
- evidence: read
- severity: low
- size: line
- cause: clamp applied without regard to step direction
- confidence: sure

## Read-only timeline: the inspector's easing picker and key editor stay live and silently drop every change
- where: packages/ui/src/components/Timeline/TimelineInspector.tsx:35 (TimelineInspector)
- scenario: `<Timeline readOnly>` (or disabled) with a segment selected: the `EasingPicker` renders fully interactive, the user picks a curve, `onChange` is swallowed by `if (edits)`, and the picker snaps back with no sign it was refused. `KeyEditorCtx` carries no `edits`/hold flag either, so a consumer's `renderKeyEditor` cannot show itself read-only; its `commit`/`setEasing` just do nothing. The rest of the timeline applies its hold (`hold.button`, tab order, `data-held`) to every control it draws.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx
- size: function
- cause: hold not forwarded to inspector controls
- confidence: likely

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

<!-- done: 4 findings, files read: 18 -->
