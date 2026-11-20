The last write to the findings file was refused: the session started asking for permission partway through. `.skulk/out/findings.md` on disk has five of the seven findings and no `Files read` section. Here is the complete document:

# Audit round 46 — diagram.effect.part1

## A failing param write drops every later stage's param write, and the plan still records them as applied
- where: packages/diagram/src/effect/audio/liveRunner.ts:67-73 (applySets), with sync at :128-129
- scenario: one edit changes levels on two stages, A then B (the sets are sorted by stage id). A's `set` names a param its def does not expose, so `validatePatches` throws `noParam`, and the bulk `graph.apply(sets)` changes nothing. The fallback then applies the sets one at a time and `break`s at A's failure, so B's write never reaches the graph. `sync` still adopts `next` as `plan`, so B's new level is recorded as live. The next diff compares against it and never resends it. B plays at its old level until its value changes again, and B shows no error. The fallback should record the failure and `continue`, not stop.
- evidence: read (graph.apply validates the whole list first, packages/audio/src/graph/createAudioGraph.ts:76-93, validate.ts:84-86)
- severity: medium

## A node whose `build` throws freezes the whole live graph and names no stage
- where: packages/diagram/src/effect/audio/liveRunner.ts:114-127 (sync)
- scenario: `build` runs inside `diffPlans` (line 115), before `structural` is assigned. A stage node whose factory throws leaves `structural` as `[]`. That can be a caller-supplied `nodes` entry, or a built-in factory's RangeError (next finding). With `structural` empty, `failingStage` finds no id, the error goes only to `console.warn`, and the stage shows no error. `adopted = from`, so the next edit of any other stage rebuilds the same diff, throws again, and is dropped too. The graph stops following the pipeline until the offending stage changes. `livePlan` (plan.ts:78-82) catches `settings()` failures per stage and makes them that stage's error. `build` failures should get the same per-node handling, naming the stage, instead of aborting the whole sync.
- evidence: read
- severity: medium

## Shipped audio nodes throw at build, not in `settings`, for a missing or unknown discrete setting
- where: packages/diagram/src/effect/audio/nodes.ts:22-32 (`node`), :44 (`audio.oscillator`), :45 (`audio.noise`)
- scenario: an `audio.noise` stage is read from a doc either without its `color` param (`readEffectDoc` makes params optional) or with `color: 'blue'`. `node()`'s `settings` drops a missing value and never validates, so `livePlan` plans the node without complaint. `createNoiseNode` then throws in `checkNoiseColor` (packages/audio/src/patchCheck.ts:33-35), but only at `build`, inside `diffPlans`. That triggers the freeze above, with no stage error. An unknown `wave` on `audio.oscillator` does the same through `checkWave`. The check belongs in `settings`, which `livePlan` already turns into a per-stage error. Otherwise a missing setting should take the stage type's default.
- evidence: read
- severity: medium

## Dragging or resizing a cluster that is on a cluster loop hangs the editor
- where: packages/diagram/src/effect/clusterHandlers.ts:39-43 (dragEdit, `depth`)
- scenario: take a doc whose clusters hold each other (`A.members = ['B', …]`, `B.members = ['A', …]`). `checkPipeline` reports this as `cluster-loop`, but `readEffectDoc` accepts it and the scene still draws it, because `nestClusters` (clusterTree.ts:51) gives each cluster one parent. Under `nodeGraph`, drag or resize A's box. `onEdit` calls `dragEdit`, which sorts `reports.boxes` by `depth`. `depth` climbs `parentCluster(doc, …)` with no visited set, A → B → A → …, and never returns, so the tab freezes. The other climbs over the same data guard against this: `within` in clusterEdit.ts:94-98 caps the climb, and `clusterAt`'s `depth` in clusterOrder.ts:62-66 keeps a `seen` set. This one should do the same.
- evidence: read
- severity: high

## `sync` assumes a throwing structural apply changed nothing, but `graph.apply` keeps applying after an execution-time failure
- where: packages/diagram/src/effect/audio/liveRunner.ts:105-106,118,125 (sync)
- scenario: `graph.apply` validates the whole list first. It then runs every patch, catches each throw, and rethrows the first one at the end (createAudioGraph.ts:76-93). So a patch that passes validation but throws when executed leaves the other patches applied. An example is an `add` whose source `start` throws while playing. `sync` then sets `plan = from`, so the plan no longer describes the graph. The next diff re-sends `add` for nodes that already exist, and validation fails with a duplicate-node error on every later edit. `sync` should adopt what landed, or re-derive it from `graph.ids()`, instead of `from`.
- evidence: read (inference on which execution-time throws occur in practice)
- severity: low

## Clearing `sources` leaves the live runner playing the old buffer
- where: packages/diagram/src/effect/audio/useFollowAudioRunner.ts:29
- scenario: a caller passes `sources: { audio: buf }`, then `sources: undefined` (file removed). The effect skips `setSources` when `sources` is undefined, so the runner keeps `buf` and `audio.file` keeps playing it. The path used when there is no runner (line 33) reads the same input as `{}` and reports "no source audio". The two paths treat "no sources" differently; undefined should reach the runner as `{}`.
- evidence: read
- severity: low

## A member named by two clusters gets a different parent in the reorder than in the drawing, and `checkPipeline` does not report it
- where: packages/diagram/src/effect/clusterOrder.ts:53-57 (parentsOf); packages/diagram/src/effect/check.ts:87-93 (checkPipeline)
- scenario: take `clusters: [{id:'A', members:['C']}, {id:'B', members:['C']}, {id:'C', …}]`. The drawing (`nestClusters`), `clusterEdit`'s `parentOf` and `clusterHandlers`' `parentCluster` all give C to the first cluster that names it, A. `parentsOf` overwrites as it goes, so it gives C to the last, B. Under `rack` or `lanes`, pressing C's title runs `clusterSlotsAt` with `up = 'B'`, so C is dragged among B's members, which is not where the drawing shows it. `checkPipeline` reports missing members and loops, but not a member claimed twice, so nothing flags the doc. `parentsOf` should keep the first claim, and the check should report the repeat.
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

<!-- done: 7 findings, files read: 31 -->