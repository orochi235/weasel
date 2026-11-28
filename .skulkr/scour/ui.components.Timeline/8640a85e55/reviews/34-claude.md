## A read-only Timeline in graph mode cannot select keys or segments, though its docs and LaneGraph's `edits` say they still select
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:131 (LaneGraph)
- scenario: `<Timeline readOnly mode="graph" …>` (or one inside `<ReadOnly>`). Timeline wraps its body in `hold.scope(...)`, so the `LayeredCurveEditor` that LaneGraph mounts reads the read-only scope through its own `useControlHold(props)` and wraps `onPointerDown`/`onKeyDown` in `hold.gate`, which ignores them whenever `refuses` (any state but enabled). A press or Enter on a graphed key or segment therefore never reaches the keyframe layer, so `onLayerChange` → `onSelect`/`onSelectSegment` never fires: nothing selects and the inspector never opens. `TimelineProps` says "Read-only … keys and segments still select", dope mode does select (Lane gates selection on `hold.looks`, i.e. only disabled), and LaneGraph's `edits={false}` path plus `refuseSteps` exist precisely to let selection through while refusing steps; all of that is dead in graph mode. Expected: read-only graph lanes select as dope lanes do, refusing only drags and steps.
- evidence: read (LayeredCurveEditor.tsx:83, 183–185; controlHold.tsx:68, 88; Timeline.hold.test.tsx:140–147 asserts the graph is `data-held="readOnly"` and only checks a step is refused)
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx, packages/ui/src/components/Timeline/Timeline.tsx (lift the editor out of the read-only scope, e.g. wrap LaneGraph's editor in a non-read-only boundary or give LayeredCurveEditor a way to take its hold from the lane, and let `edits` do the refusing)
- size: function
- cause: editor's own hold re-reads the timeline's scope and refuses more than the timeline does
- confidence: likely

## An arrow step on a key past the timeline's duration jumps it back to the duration, whichever arrow is pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:167 (markKeys)
- scenario: `duration={1000}` with a key at t=1500 (keys past the duration are drawn, faded via `data-past`/`afterEnd`, so this is a state the component expects). Focus the key and press ArrowRight: `to = max(0, min(last=1000, 1510)) = 1000`, which differs from t, so `onKeyChange(i, 1000)` moves the key 500 ms to the LEFT. ArrowLeft likewise moves it 500 ms instead of 10. Expected: a step that would cross the limit outward is refused (or the clamp only stops further outward travel), not converted into a large move the other way. Graph mode has the same behavior through `xClamp = [0, limit - offset]` in LaneGraph.tsx:77 and the layer's `nudgedKey` clamp.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx (or CurveEditor/keyframeEdits.ts nudgedKey)
- size: line
- cause: clamp to limit applied to keys already beyond it
- confidence: sure

## The inspector reports an `onChange` for an edit that changed nothing
- where: packages/ui/src/components/Timeline/TimelineInspector.tsx:50 (TimelineInspector, `commit` / `setEasing`)
- scenario: a `renderKeyEditor` whose field commits on blur calls `commit({ ...key })` with the key's current value, or `setEasing` with the easing already set (or the EasingPicker reports the current curve). `setKeyValue`/`setKeyEasing` build a new track array and `onChange` fires with tracks equal to the old ones, creating an undo step for nothing. The edit protocol (`docs/conventions.md`, "Edit callbacks") says `onChange` never fires "for one that changed nothing", and the dope-mode key paths honor it (Timeline.tsx `onKeyChange` returns when the time is unchanged; Lane's `markKeys` skips `to === t`).
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/TimelineInspector.tsx
- size: line
- cause: no unchanged-value check before onChange
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

<!-- done: 3 findings, files read: 18 -->
