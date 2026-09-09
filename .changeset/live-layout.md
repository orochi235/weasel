---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

Layout you can watch, and push against.

`usePoseRun` is the transport: each frame it asks a producer for poses,
publishes them to the scene's ephemeral override channel — the one a drag
already writes to, which `effectivePose`, derived geometry and the pick source
read — and commits the lot as one batch when the producer says it is done or
the consumer stops it. Cancel drops the frames and the document is untouched.
It runs behind `useVisibleRaf`, and it knows nothing about layout.

A node carrying an override the run did not publish belongs to another gesture:
the run never writes it, never commits it, and reports it to the producer as
pinned. Dragging a box mid-run is therefore the consumer's ordinary move tool,
with no gesture contributed by the diagram package.

`useLiveLayout` in `@weasel-js/diagram` drives it. `force` relaxes one tick a
frame off the same force list the one-shot `force` runs, holding a pinned node
with `fx`/`fy` while its neighbors answer; `layered` and `tree` ease into a
target computed once. A node or edge appearing or disappearing re-heats the run.

`SceneNode.pickable: false` makes a node transparent to the hit-test walk, so a
press lands on what is behind it. Without it the innermost hit wins and dragging
a labeled box pulls the label out of the box.
