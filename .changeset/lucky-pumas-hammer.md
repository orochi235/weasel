---
'@weasel-js/core': patch
---

Walk the scene once in `renderOrder()` instead of once per layer.

The generator behind `renderOrder()` and `toJSON()` was layer-major in the
literal sense: it ran a full DFS of the tree for every layer and yielded only
the nodes belonging to that pass, so producing N ids cost L×N work. A single
DFS now buckets each node by its layer and concatenates the buckets, which is
O(N + L). The emitted sequence is unchanged — same layer-major order, same
DFS-preorder within each layer, same skip for dangling child ids — and a
differential test holds the new implementation to a transcription of the old
one across 200 generated scenes plus mutation, layer-edit and undo sequences.

Over 10k nodes the layer sweep goes from 0.37 ms / 1.03 ms / 3.54 ms / 12.93 ms
at 1 / 4 / 16 / 64 layers to 0.30 / 0.35 / 0.40 / 0.42. The flat single-layer
case improves too, 0.37 ms → 0.33 ms at 10k nodes and 2.1x at 100 nodes, since
one pass replaces the per-yield generator overhead.

`renderOrder()` now returns an array rather than a generator, so a caller that
stops early no longer avoids the rest of the walk. Every caller in the repo
drains it fully except four test helpers reading the first id from a handful of
nodes. Its declared type stays `Iterable<NodeId>`.
