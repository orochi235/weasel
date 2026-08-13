---
'@weasel-js/core': patch
---

Add `scene.renderOrderNodes()`, and scan it in the area hit-test.

`renderOrder()` hands back ids, and almost every caller immediately resolves
each one back to a node — a map lookup per node, per query, for a node the
traversal had in hand and dropped. `renderOrderNodes()` is the same
layer-major sequence as the nodes themselves. It is a snapshot, freshly built
per call, exactly like `renderOrder()`.

`hitTestArea` (marquee and lasso) now scans it, and reads `pose.kind` inline
instead of through the `isPathLike` predicate. Together those recover the
5–17% the AABB memo cost rect scenes and take a good deal more besides
(`npm run bench`, `min` column, three alternating runs per build on one
machine; run-to-run scatter on these was under 3%):

| 10,000 nodes, 25% query rect | before | after |
|---|---|---|
| rect poses | 0.94 ms | 0.53 ms |
| 24-gon silhouettes | 1.21 ms | 0.78 ms |

`renderOrder()` itself gets a separate walk for the single-layer case, which
needs no per-layer buckets and can compare the layer id rather than index it:
10,000 nodes over one layer 0.27 ms → 0.19 ms, with multi-layer scenes
unchanged. `toJSON()` rides the nodes walk and skips its lookups too.

`Scene` gains a method, so a hand-written stand-in for a scene needs to
implement it; scenes from `createScene` and `sceneFromJSON` already do.
