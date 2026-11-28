# forge.timeline findings

## A story's `seek` sends a multi-pass clock back to its first pass, where the transport's seek keeps the current pass
- where: packages/forge/src/timeline/shown.ts:9 (seekShown), used by packages/forge/src/timeline/context.ts:103 (useTimeline `seek`)
- scenario: the trial transport's loop control sets `clock.loop = 3` (TrialTransport `onLoopChange` takes `boolean | number`). During pass 2 the story calls `useTimeline().seek(t)`. `seekShown` seeks to `within`, which is in pass 0, so the run plays two extra passes. The transport's own `seek` (labkit transportControl.ts:107) seeks to `passStart + within` and stays in pass 2. So the same move gives two different answers depending on whether the story or the transport makes it. On a story's own clock, where loop is only ever a boolean, it does no harm.
- evidence: read
- severity: low
- fix: packages/forge/src/timeline/shown.ts, packages/labkit/src/clock/transportControl.ts
- size: function
- cause: two seek rules for one clock
- confidence: likely

## `useTimeline().loop` reports `true` for a finite pass count, and `setLoop` can only write a boolean
- where: packages/forge/src/timeline/context.ts:93 (useTimeline)
- scenario: the transport sets `clock.loop = 3`. The story reads `loop: true` (`clock.loop !== false`), so it cannot tell "loop forever" apart from "three passes". If it then calls `setLoop(true)` to keep what it read, it replaces the pass count with endless looping.
- evidence: read
- severity: low
- fix: packages/forge/src/timeline/types.ts
- size: function
- cause: boolean view of `boolean | number` loop
- confidence: likely

## A story's `seek` and `setLoop` skip the transport's `touch`, while its `play`, `pause` and `setRate` mark the clock as touched
- where: packages/forge/src/timeline/context.ts:103-104 (useTimeline actions)
- scenario: inside a lab, `play`, `pause` and `setRate` go through `useTransportControl`, whose wrappers call `hold.touch()`. `seek` and `setLoop` write the clock directly. The transport's own loop change calls `control.touch()` first (TrialTransport.tsx:77), and so does its own seek. Suppose a story whose trial has `replay` set calls `setLoop(false)` or `seek` to the end. The transport still counts the clock as untouched, so its auto-replay effect (TrialTransport.tsx:49) starts the run over against what the story asked. A transport `seek` would have stopped that.
- evidence: read
- severity: low
- fix: packages/forge/src/timeline/moves.ts
- size: function
- cause: seek and loop bypass PlayMoves
- confidence: likely

## A redeclared span is applied a second time to a newly made clock when the spec comes back after being null
- where: packages/forge/src/timeline/StoryClock.tsx:29-34 (useOwnClock)
- scenario: CaptureView passes spec A, then B (declared becomes B's key), then null (clock dropped), then A. The new clock is built from A, but `declared.current` is still B's key, so the effect calls `declare(A)` again on the clock it was just built from. The doc says the clock keeps any span the story's `setSpan` laid over it. If `declare` resets position or override state, a `setSpan`, seek or hold made between the render and the effect is undone. Building the clock in the render never updates `declared`.
- evidence: read
- severity: low
- size: line
- cause: `declared` ref not reset when the clock is recreated
- confidence: likely

## Files read
packages/forge/src/timeline/Playhead.stories.tsx
packages/forge/src/timeline/RoutePlayhead.tsx
packages/forge/src/timeline/StoryClock.tsx
packages/forge/src/timeline/clockSpec.ts
packages/forge/src/timeline/context.ts
packages/forge/src/timeline/declare.ts
packages/forge/src/timeline/moves.ts
packages/forge/src/timeline/playheadUrl.ts
packages/forge/src/timeline/shown.ts
packages/forge/src/timeline/transport.css
packages/forge/src/timeline/types.ts
packages/forge/src/timeline/workshopHarness.tsx

<!-- done: 4 findings, files read: 12 -->
