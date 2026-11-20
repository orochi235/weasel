# Findings — diagram.effect.part1

## A node `build` that throws freezes the whole live graph, with no stage named
- where: packages/diagram/src/effect/audio/liveRunner.ts:114-127 (createLiveAudioRunner `sync`)
- scenario: `diffPlans(from, next, build)` calls each added/replaced node's `build` inside the `try`, before
  `structural` is assigned. When a build throws — e.g. an `audio.reverb` stage whose saved `seconds` is 0 (or
  any value `impulseResponse` rejects: `!(seconds > 0)`), or a custom `nodes` entry's `build` — the catch runs
  with `structural = []`, so `failingStage` finds no id and no stage gets an error, and `adopted = from`
  discards the *entire* new plan. Every later `setPipeline`/`setSources` rebuilds the same failing node and is
  rejected the same way, so no edit to any other stage reaches the graph until the bad stage is fixed, and the
  user is never told which stage it is. `AudioStageNode.settings` documents "Throws to fail the stage" and
  `livePlan` catches that per stage; `build` throwing should fail its stage the same way (catch per node, put
  the message under that stage, and leave it out of the plan) rather than rolling back everything.
- evidence: read (packages/audio/src/impulse.ts:31 throws RangeError for seconds ≤ 0; processors.ts:92 calls it from createReverbNode)
- severity: medium

## `pause()` (or `reset()`) during `play()`'s unlock is undone when the unlock resolves
- where: packages/diagram/src/effect/audio/liveRunner.ts:148-154 (createLiveAudioRunner `play`)
- scenario: `play()` awaits `engine.unlock()` and then unconditionally `graph.start()`s and publishes
  `playing: true`; it only checks `disposed`. A user who presses Play then Pause before the unlock settles (the
  first unlock waits on the AudioContext resuming, which can take a user-noticeable time), or a `reset()` in that
  window, ends with the graph sounding and `state.playing === true` — the pause, which already published
  `playing: false`, is silently reversed. `reset()`'s documented "not playing" is likewise broken: the fresh
  graph starts. `play` should note a generation/intent before awaiting and skip the start when a
  `pause`/`reset` came after it.
- evidence: read
- severity: low

## `clusterAt` / `clusterSlotsAt` read a twice-named member's parent as the *last* cluster naming it; the rest of diagram uses the first
- where: packages/diagram/src/effect/clusterOrder.ts:53-57 (`parentsOf`), used at :61-71 (`clusterAt` depth) and :89-92 (`clusterSlotsAt` siblings)
- scenario: diagram's ruled convention (clusterTree.ts:5, "a node belongs to the first cluster that names it",
  tested in clusterTree.test.ts) and clusterEdit's `parentOf` (`clusters.find(...)`, first wins) both put a member
  named by two clusters in the first. `parentsOf` builds a Map by `parent.set(m, g.id)` over every cluster in
  order, so the last one wins. For `clusters: [P{members:[C, …]}, Q{members:[C, …]}, C{…}]` the drawn box of C sits in P,
  but a grip drag on C's title under `rack`/`lanes` builds its reorder sequence from Q's members (wrong siblings,
  possibly fewer than 2 → no drag, or slots among stages that are not C's neighbours), and `clusterAt`'s depth
  ranking measures C's nesting through Q. `checkPipeline` does not flag a member named twice, so such a doc
  reaches here unreported. `parentsOf` should keep the first (`if (!parent.has(m))`).
- evidence: read
- severity: low

## `dragEdit`'s `depth` climbs a cluster loop forever, hanging the tab on a box drag
- where: packages/diagram/src/effect/clusterHandlers.ts:39-44 (`dragEdit`, `depth`)
- scenario: `depth` walks `parentCluster(doc, at)` until it is `undefined`, with no seen-set or step bound. A doc
  whose clusters hold each other (`clusters: [{id:'A', members:['B','s1']}, {id:'B', members:['A','s2']}]`) is
  accepted — `checkPipeline` only *reports* `cluster-loop`, and the editor still draws both boxes (clusterTree
  settles the loop, B inside A). Under `nodeGraph`, dragging A's box moves B's with it and `regionEditing`
  reports a `box` edit for each moved container, so `reports.boxes` has two entries and the `.sort` comparator
  calls `depth('A')`: A→B→A→B… never terminates, freezing the page. (Two looped boxes multi-selected and dragged
  do the same.) The equivalent climbs elsewhere were bounded for exactly this (`within` in clusterEdit.ts:94-98,
  `clusterAt`'s seen-set in clusterOrder.ts:62-66, commit 4b25e60c79 for `groupAt`); this one was missed.
- evidence: read (regionEditing.ts:39-45 pushes a box edit per moved container)
- severity: high

## Two wires sharing an `id` make `EffectChart`/`EffectEditor` throw in render; nothing reports or drops the repeat
- where: packages/diagram/src/effect/draw.ts:267-272 (`wireEdges`), packages/diagram/src/effect/check.ts:51-71 (`checkPipeline`)
- scenario: `wireEdges` passes each drawable wire's own `id` as the edge id. A pipeline whose `wires` hold
  `{id:'w1', from:a.out, to:b.in}` and `{id:'w1', from:b.out, to:c.in}` — e.g. a hand-merged or older saved doc;
  `readEffectDoc` (docShape.ts:79) checks only that an id is a string — reaches `diagramScene`, which throws
  `edge id "w1" names two different edges` (fromData.ts:199). Under `nodeGraph` and `lanes` that throw comes
  out of `EffectChart`'s and `EffectEditor`'s render `useMemo`, so the whole chart unmounts behind an error
  boundary. draw.ts drops a repeated stage (`uniqueStages`) and a repeated cluster (`uniqueClusters`) for exactly
  this reason ("`diagramScene` throws on a repeated id"), and `checkPipeline` reports `duplicate-stage` and
  `duplicate-cluster`, but a repeated wire id is neither dropped nor reported; `checkPipeline` promises
  "Everything wrong with `pipeline`". It should be handled the same way: report it, and draw the second wire
  with no id (or under a minted one) rather than throw.
- evidence: read
- severity: medium

## One wire into a port the node lacks rolls the live graph back whole: no other edit reaches it
- where: packages/diagram/src/effect/audio/plan.ts:66-89 (`livePlan` edges), packages/diagram/src/effect/audio/liveRunner.ts:118-127 (`sync`)
- scenario: `livePlan` turns every wire into an edge `{node: to.stage, port: to.port}` without checking that
  the port is one the stage's node takes. A saved doc with a stale wire into `gain.inn`, or a stage whose
  `inputs` name a port its node def lacks (an `audio.mix` stage given an input `c`; a custom `nodes` entry),
  makes `validatePatches` throw `node "gain" has no input port "inn"` for the structural batch. `sync` then sets
  `adopted = from` and drops the sets, so the graph keeps the plan from before; every later `setPipeline`
  recomputes the same bad edge and is rejected again. Changing any other stage's settings or wiring does
  nothing audible while that one wire exists, though the error is shown only on the one stage. `checkPipeline`
  reports a missing port as a wire problem, not a reason to stop the graph; the plan should leave such an
  edge out (and put the error on its stage) as it already leaves out a stage whose `settings` throws.
- evidence: read (packages/audio/src/graph/validate.ts:72-79 rejects the whole list on one bad connect)
- severity: medium

## `useFollowAudioRunner` never hands the runner a `sources` that went back to `undefined`
- where: packages/diagram/src/effect/audio/useFollowAudioRunner.ts:29
- scenario: the effect is `if (sources !== undefined) runner?.setSources(sources)`. A caller that clears its
  file (`sources: loaded ? { audio } : undefined`) leaves the runner on the old buffer: the `audio.file` stage
  keeps playing it and shows no error. With no runner, the same hook's `planned` run reads `sources ?? {}` and
  reports "no source audio" for that stage, so the two paths answer the same input differently. Passing
  `sources ?? {}` to the runner would match.
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
