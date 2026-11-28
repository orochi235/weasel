# Findings: diagram.effect.part1

## A paused live runner drops every stage's preview when an edit changes its errors
- where: packages/diagram/src/effect/audio/liveRunner.ts:213 (publishErrors)
- scenario: previews 'scope', play, pause: each tapped stage shows its last scope window. Now an edit changes the error set (wire a stage into a port its node lacks, or fix an error). `publishErrors` publishes `errorsRun(next)`, which has no previews, so every stage's scope disappears. `frame()` only runs while playing (useFollowAudioRunner's loop), so nothing puts them back until play. An edit that leaves the errors alone keeps them. The run should keep the last drawn previews and update only the errors, e.g. by drawing from the taps again (`previews.draw(next) ?? errorsRun(next)`).
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/audio/liveRunner.ts
- size: line
- cause: errors-only run replaces the preview run
- confidence: likely

## checkPipeline is silent about two wires into an input that does not take many
- where: packages/diagram/src/effect/check.ts:96 (checkPipeline, wire loop)
- scenario: a pipeline loaded from a file has wires a.out→b.in and c.out→b.in, where `b.in` has no `many`. The editor treats that input as already fed (`inputFed`/`canWire` in edit.ts refuse a second wire), and the runner reads only one value for a non-`many` input, but `checkPipeline` reports nothing, `drawableWires` draws neither wire as a problem, and `onProblems` says the pipeline is fine. The same question ("may this input take a second wire?") gets two different answers. checkPipeline should report the second wire (for example as a new `kind`) so the drawing flags it.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/check.ts
- size: function
- cause: fan-in rule enforced only in the editor
- confidence: likely

## checkPipeline misses a member a cluster lists twice
- where: packages/diagram/src/effect/check.ts:140 (checkPipeline, duplicate-member)
- scenario: `clusters: [{ id: 'g', members: ['a', 'a'] }]`. `holder.get('a')` returns 'g', so `first !== cluster.id` is false and nothing is reported, although `duplicate-member` exists for a member named twice. Code that reads `members` directly gets the repeat too: `clusterSlotsAt` builds its siblings from `members`, which gives two reorder items with the same id. It should report the repeat within one cluster as well.
- evidence: read
- severity: low
- fix: packages/diagram/src/effect/check.ts
- size: line
- cause: repeat check only across clusters
- confidence: likely

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

<!-- done: 3 findings, files read: 31 -->
