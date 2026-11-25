# Audit round 46 — diagram.effect.part2

## A preview that rejects leaks the bitmaps already made for that stage and fails the whole run instead of the stage
- where: packages/diagram/src/effect/runner/pass.ts:73 (createPass → record), :93 (evaluate)
- scenario: a stage with two shown ports whose kind's `preview` resolves a bitmap for the first and rejects for the second (e.g. `createImageBitmap` on a zero-size or detached source). `record` has put the first bitmap only in its local `previews` map, never in `run`, so `runPipeline`'s `closeBitmaps(previewsOf(pass.run))` and the runner's step cleanup never see it: it is never closed. And because `evaluate` does `return record(...)` without `await` inside its `try`, the rejection bypasses the `catch` that would have recorded a stage `error`; the whole `step()`/`runPipeline` rejects instead, so one bad preview kills the run (and `useEffectRunner`'s `run()` rejects) rather than showing an error on the stage as the evaluator contract describes for failures.
- evidence: read
- severity: medium

## useEffectRunner keeps stale sources and options when the caller sets them back to undefined
- where: packages/diagram/src/effect/runner/useEffectRunner.ts:33-41 (useEffectRunner)
- scenario: a component renders `useEffectRunner({ ..., sources: { img } })`, then later `sources: undefined` (image unloaded), and its owner closes `img` after `idle()`. The effect skips `setSources` when `sources === undefined`, so the runner keeps the old record and the next run hands evaluators the closed bitmap. The same holds for `kinds`, `previews` and `previewSize`: going from a value back to undefined leaves the old value in force (`setOptions` merges, so omitting a key never clears it), e.g. `previews: false` → `undefined` keeps previews off when the default is on. The hook's doc says it follows the options "as they change".
- evidence: read
- severity: medium

## mainChain caches a path cut short by a loop and reuses it, so it is not the longest path on a pipeline with a feedback loop
- where: packages/diagram/src/effect/mainChain.ts:15-29 (mainChain → from)
- scenario: data wires A→B, B→C, C→A, D→B, stages in order A, B, C, D. Walking from A, `from(C)` meets A in `walking` and caches C = [C]; B = [B, C] is cached from that truncated walk. `from(D)` then reuses B's cached [B, C] and answers [D, B, C], so the result is [A, B, C] (3 stages) while the longest simple path is D, B, C, A (4). The doc promises "the longest path over data wires"; `rack` uses it as the default line and `lanes` as its order, so a pipeline with a feedback wire gets a shorter chain than it has, depending on stage order.
- evidence: read (traced by hand)
- severity: low

## The generic runner hands a `many` input only its first wire's value, silently dropping the rest
- where: packages/diagram/src/effect/runner/pass.ts:50-59 (createPass → inputsOf)
- scenario: a stage whose input port has `many: true` (documented as "An input that takes any number of wires, which a runner combines") is fed by two wires that both carry values. `inputsOf` skips every wire after the first that reached the port (`inputs.has(w.to.port)`), so the evaluator sees one value and there is no way to receive the others; nothing in `EffectEvalContext` exposes them. The audio runner sums them; this runner neither combines nor passes them on, nor reports the drop.
- evidence: read
- severity: low

## freeSpot can loop forever when the view is far from the origin
- where: packages/diagram/src/effect/place.ts:22-26 (freeSpot)
- scenario: the editor (`EffectEditor.tsx:153`) passes the visible world rect. With the view panned to x ≈ 1e17 (ulp 16), `x += STEP` (8) is a tie that rounds back to `x` whenever x's mantissa is even, so the inner loop never advances while the spot is blocked by a box, and the add-stage call hangs the tab. The same holds for `y += STEP`. Below that magnitude the step is still lossy (positions snap to the ulp grid) but terminates.
- evidence: read (float reasoning, not run)
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

<!-- done: 5 findings, files read: 30 -->
