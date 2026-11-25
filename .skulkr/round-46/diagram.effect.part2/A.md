# Findings: diagram.effect.part2

## A throwing value kind's `preview`/`show` fails the whole run instead of the stage, and leaks the previews already made for that stage
- where: packages/diagram/src/effect/runner/pass.ts:85,93 (createPass → evaluate / record)
- scenario: `evaluate` does `return record(...)` inside its `try` without `await`, so a rejection from `record` is not caught by the `catch` that turns failures into `EffectStageRun.error`. A kind whose `preview` rejects (e.g. `createImageBitmap` on a zero-sized or detached value) or whose `show` throws makes `pass.step()` reject: `runPipeline` rejects for every stage, not just the one, and the runner's `enqueue` rethrows it to the caller. Bitmaps already made for earlier ports of that stage sit in the local `previews` object, never reach `run`, and are never closed (runPipeline's catch only closes `previewsOf(pass.run)`). Same for a bypassed stage (line 85, outside the try). While playing, `advance`/`seek` start those runs with `void enqueue(...)` (runner.ts:157,161), so every frame raises an unhandled promise rejection. Expected: the stage records an error and the made bitmaps are closed.
- evidence: read
- severity: medium

## A `many` input gets only the first reached wire's value; the generic runner never combines them
- where: packages/diagram/src/effect/runner/pass.ts:50-59 (inputsOf)
- scenario: `EffectPort.many` says the input "takes any number of wires, which a runner combines". `inputsOf` skips every wire after the first whose port is already filled (`inputs.has(w.to.port)`), so with two reached wires into a `many` input the evaluator sees one value and the other is silently dropped; nothing in `EffectEvalContext` exposes the rest, so no evaluator can combine them. The audio runner sums (docs/unruled.md 2026-10-20); the image runner answers the same question differently.
- evidence: read
- severity: low

## `useEffectRunner` never clears an option the caller stops passing
- where: packages/diagram/src/effect/runner/useEffectRunner.ts:33-41
- scenario: `sources`, `kinds`, `previews`, `previewSize` are passed on only when defined. A host that renders `previews={false}` and later omits it keeps previews off (the default is true); one that drops `sources` (because it closed them) leaves the runner reading the old, closed sources on the next run; dropping `kinds` keeps the old kinds' show/preview/dispose. The hook's doc says it follows the options as they change.
- evidence: read
- severity: low

## `setOptions` does not restart a step run, so a stepped pass keeps the old evaluators/kinds while whole runs use the new ones
- where: packages/diagram/src/effect/runner/runner.ts:181-183 (setOptions)
- scenario: `setPipeline` and `setSources` drop the stepping pass; `setOptions` does not. After `setOptions({ evaluators: next })` mid-step, further `step()` calls keep evaluating with the evaluators captured when the pass was made (createPass closes over `opts`), while `run()`/`advance()` use the new ones, so stepping and running the same pipeline show different results until the pass wraps.
- evidence: read
- severity: low

## `mainChain` memoizes paths cut short by a loop, so on a pipeline with a feedback loop the "longest path" depends on stage order and can miss the real one
- where: packages/diagram/src/effect/mainChain.ts:15-30 (mainChain → from)
- scenario: stages listed `[C, A, B, D]`, data wires A→B, B→C, C→A, C→D. `from(C)` walks C→A→B, where B's only successor C is on the walk, so `best` caches B = [B] and A = [A, B]; C becomes [C, A, B]. Later starts at A and B hit those truncated cache entries, so the result is [C, A, B] (3 stages) although A→B→C→D (4) exists; list the stages as `[A, B, C, D]` and the answer is [A, B, C, D]. `rack` puts the returned chain on its line and `lanes` uses it as the reorder axis, so reordering the stage list of a looped pipeline changes which stages sit on the main line, and D is hung off the side.
- evidence: read (traced by hand)
- severity: medium

## A stage whose id starts with `~lane:` collides with the lanes look's lane nodes and makes `diagramScene` throw
- where: packages/diagram/src/effect/lanes.ts:49,264 (laneId, lanes)
- scenario: a pipeline with a value type `image` and a stage whose id is `~lane:image` (stage ids are free strings; nothing reserves the prefix). The lanes look emits a lane node `laneId('image')` = `~lane:image` beside the stage's node, and `diagramScene` throws `two things would share the scene id "~lane:image"`; `laneTypeOf` would also read the stage as a lane, so `nodeStyle` paints it as a lane body. Other looks draw the same pipeline fine.
- evidence: read
- severity: low

## Files read
packages/diagram/src/effect/lab/EffectLab.stories.tsx
packages/diagram/src/effect/lab/samples.ts
packages/diagram/src/effect/laneColumns.ts
packages/diagram/src/effect/lanes.ts
packages/diagram/src/effect/lanesFixture.ts
packages/diagram/src/effect/lanesRoutes.ts
packages/diagram/src/effect/lookRoutes.ts
packages/diagram/src/effect/looks.ts
packages/diagram/src/effect/mainChain.ts
packages/diagram/src/effect/nodeGraph.ts
packages/diagram/src/effect/place.ts
packages/diagram/src/effect/rack.ts
packages/diagram/src/effect/releaseReplaced.ts
packages/diagram/src/effect/renameClusterAction.ts
packages/diagram/src/effect/run.ts
packages/diagram/src/effect/runPorts.ts
packages/diagram/src/effect/runner/order.ts
packages/diagram/src/effect/runner/params.ts
packages/diagram/src/effect/runner/pass.ts
packages/diagram/src/effect/runner/previews.ts
packages/diagram/src/effect/runner/runPipeline.ts
packages/diagram/src/effect/runner/runner.ts
packages/diagram/src/effect/runner/types.ts
packages/diagram/src/effect/runner/useEffectRunner.ts
packages/diagram/src/effect/skipFixture.ts
packages/diagram/src/effect/stageTypes.ts
packages/diagram/src/effect/symbolFlow.ts
packages/diagram/src/effect/symbolParts.ts
packages/diagram/src/effect/symbols.ts
packages/diagram/src/effect/types.ts

<!-- done: 6 findings, files read: 30 -->
