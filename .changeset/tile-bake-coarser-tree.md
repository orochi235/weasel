---
'@weasel-js/core': patch
---

A tile bake prunes its walk by the visibility index's tree at a coarser zoom when one is kept, instead of building one for its own zoom.

That build walked every node: on `tile-zoom.spec.ts` (100k nodes) each level new to a zoom cost its frame 100–118 ms. A coarser tree's boxes are wider, so it prunes a little less but never wrongly. `WiredSceneSlot.subtreeCull` takes `{ coarser }` for this.

<!-- entry: fix perf -->
