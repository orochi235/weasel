## A read-only Timeline in graph mode selects no key or segment: its ReadOnly scope makes the curve editor refuse every press and key
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:126 (LaneGraph)
- scenario: `<Timeline readOnly mode="graph" …>` (or inside a `<ReadOnly>` scope). `Timeline` wraps its body in `hold.scope(...)` → `holdScope(own, …)`, which puts a `ReadOnly` context around every lane (Disabled.tsx:84). `LayeredCurveEditor` reads that context through its own `useControlHold`, so `hold.refuses` is true and it mounts `onPointerDown={hold.gate(onSvgPointerDown)}` and `onKeyDown={hold.gate(onSvgKeyDown)}` (LayeredCurveEditor.tsx:183–185), which `gate` turns into no-ops. The keyframe layer selects a key or segment from those handlers (createKeyframeLayer.tsx:126/163), so pressing a key or segment, or Enter on one, selects nothing, and the inspector never shows. Timeline's doc says read-only "keys and segments still select … and the view … switches to the graph"; dope mode honors that (Lane's `looks` gate), and LaneGraph's own `edits={false}` path (`refuseSteps`, `onLayerChange` keeping selection) was written for exactly that case but never runs because the editor refuses first.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx, packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx
- size: function
- cause: outer ReadOnly scope reaches the nested editor, whose gate refuses selection too
- confidence: likely

## An arrow step on a key already past the timeline's duration moves it backwards to the duration, whichever arrow was pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:178 (markKeys)
- scenario: `duration={2000}` with a sampled key at t=3000 (a consumer's tracks longer than `duration`, or a nested row whose `offset + t` exceeds it). Focus the key, press ArrowRight: `to = Math.max(0, Math.min(last, t + 10))` = `min(2000, 3010)` = 2000, so a step meant to move it 10 ms later jumps it 1000 ms earlier and commits that through `onChange`. ArrowLeft does the same jump. Expected: a step that would cross the limit away from it is refused (or clamps only toward the limit from inside it), not a teleport in the opposite direction. The graph path's `xClamp` (LaneGraph.tsx:79) has the same shape.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx
- size: line
- cause: clamp applied to the stepped time without regard to the key starting out of range
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

<!-- done: 2 findings, files read: 18 -->
