## Two wires with the same ends map to one wire id, so editing the second edits the first
- where: packages/diagram/src/effect/editorMapping.ts:61 (editorScene, `byEnds` / `wires`)
- scenario: a doc (read from a file, or a pipeline handed in) holds wires `w1` and `w2` with the same from and to ports. Under `nodeGraph` they draw as two edges with ids `w1` and `w2`, but `byEnds` keeps only the first id per ends, so `wireOf('w2')` answers `w1`. Selecting the `w2` edge and pressing Delete removes `w1` and leaves `w2`; a route or label dragged on `w2` is stored under `w1`. `checkPipeline` does not flag same-ends wires, so nothing warns. Expected: each drawn edge maps to its own wire (the edge id already is the wire id under `nodeGraph`).
- evidence: read
- severity: low

## A numeric audio setting given as text is passed through unparsed, while a level given as text is parsed
- where: packages/diagram/src/effect/audio/nodes.ts:44 (`node` settings; `audio.reverb`'s `seconds: null`)
- scenario: a reverb stage whose `seconds` param has no `control` (`docShape` allows it) carries only its display value, so `paramValues` gives the string (e.g. "2" or "2 s"), and `settings` hands that string to `createReverbNode` unchecked. The same stage's `mix` level given as text goes through `givenLevel` in plan.ts, which parses it or fails the stage with a message. Expected: `seconds` is read as a number, or the stage fails with a named error, as a level does.
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
