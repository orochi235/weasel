# Findings: diagram.effect.part1 (audit round 74)

## A live runner's apply-time failures are shown once, then erased by the next unrelated edit while the stage stays broken
- where: packages/diagram/src/effect/audio/liveRunner.ts:183 (createLiveAudioRunner `sync`), with `applyStructure` (:131) and `applySets` (:66)
- scenario: a structural batch passes `graph.check` but `graph.apply` throws (a source that fails to start, the case `applyStructure` documents as "lands"), or one param `set` throws in `applySets`. `sync` adopts `next` as `plan` anyway and puts the message in `merged`, so the stage shows its error. On the next `setPipeline`/`setSources` (say a gain tweak on a different stage), `merged` is rebuilt from `planned.errors` only, and `diffPlans(plan, …)` sends nothing for the failed node or level, because `plan` already records it as applied. `publishErrors` then publishes a run with no error for that stage. The source is still silent, or the param still holds its old value, but the chart no longer says why. Setting the same value again sends no patch either, since `plan` already holds it. A failure that is never retried should stay in `errors` until a later patch for that stage lands, or the failed node or level should be left out of the adopted plan so the next diff retries it.
- evidence: read
- severity: medium

## `typeColors` gives every type `undefined` as its color when the theme's `series` is empty
- where: packages/diagram/src/effect/draw.ts:77 (typeColors)
- scenario: a look is given a custom `theme` whose `series` is `[]`, which `DiagramTheme` allows. `series[colors.size % 0]` is `series[NaN]`, which is `undefined`, and the `!` passes it on. Every port type then maps to `undefined` instead of falling back to `UNTYPED`, so wires and ports get `stroke: undefined`. It should fall back to `UNTYPED` when `series` is empty.
- evidence: read
- severity: low

## Files read
packages/diagram/src/effect/EffectChart.tsx
packages/diagram/src/effect/EffectEditor.tsx
packages/diagram/src/effect/audio/livePreviews.ts
packages/diagram/src/effect/audio/liveRunner.ts
packages/diagram/src/effect/audio/nodes.ts
packages/diagram/src/effect/audio/patches.ts
packages/diagram/src/effect/audio/plan.ts
packages/diagram/src/effect/audio/scope.ts
packages/diagram/src/effect/audio/stageTypes.ts
packages/diagram/src/effect/audio/useFollowAudioRunner.ts
packages/diagram/src/effect/audio/useLiveAudioRunner.ts
packages/diagram/src/effect/chainEdit.ts
packages/diagram/src/effect/check.ts
packages/diagram/src/effect/clusterEdit.ts
packages/diagram/src/effect/clusterHandlers.ts
packages/diagram/src/effect/clusterOrder.ts
packages/diagram/src/effect/clusterTitle.tsx
packages/diagram/src/effect/compact.ts
packages/diagram/src/effect/docShape.ts
packages/diagram/src/effect/draw.ts
packages/diagram/src/effect/edit.ts
packages/diagram/src/effect/editorHandlers.ts
packages/diagram/src/effect/editorMapping.ts
packages/diagram/src/effect/editorPicks.ts
packages/diagram/src/effect/editorReorder.ts
packages/diagram/src/effect/glyphs.ts
packages/diagram/src/effect/image/evaluators.ts
packages/diagram/src/effect/image/stageTypes.ts
packages/diagram/src/effect/image/testCard.ts
packages/diagram/src/effect/image/valueKinds.ts
packages/diagram/src/effect/lab/EffectLab.stories.module.css

<!-- done: 2 findings, files read: 31 -->
