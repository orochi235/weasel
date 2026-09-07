---
'@weasel-js/core': patch
---

Undo of a Delete now brings back everything the delete cascaded — a node's
dependents, and their own subtrees — not just the node that was named.

Deleting a node takes everything deriving from it, so deleting a box takes the
edges drawn from it. The delete op only ever snapshotted the subtree, so undo
re-inserted the box alone and the edges stayed gone. The op now snapshots the
whole set before removing, and re-inserts it parent-first, each node at the slot
it held.

New public read: `scene.removalClosure(ids)` answers what `removeMany(ids)`
would take, without taking it. The scene owns the cascade relations, so a caller
that rebuilds the walk from `dependsOn` and `children` goes stale the moment a
relation is added — `buildDeleteOps` asked its own copy of that question and is
now on this one.

The delete op reads it through an optional `getRemovalClosure(ids)` on the
adapter, alongside `getChildren`. An adapter that cascades along nothing but the
subtree can leave it out and behaves as before; one that cascades further has to
answer, or the nodes it takes are absent from the snapshot. The scene-backed
adapters answer it.

`insertNode` on the scene-backed adapters now forwards the function-valued
fields — `dependsOn`, `derivePath` and `clipFromPose` — so a restored edge
derives again instead of coming back as a static path, and a restored container
still clips. The delete op's serialized `descendants` argument is now
`cascaded`, and carries the node itself alongside what went with it.
