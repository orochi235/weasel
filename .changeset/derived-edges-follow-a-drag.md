---
'@weasel-js/core': patch
---

A derived edge follows the drag that moves its endpoint

`move`, `resize` and `rotate` kept their in-flight poses in action-local
scratch and published them only as `previewIds` / `previewPose`. That surface
is enough to paint a ghost and size selection chrome, but nothing that asks
the *scene* where a node is can see it — and `scenePoseLookup`, which resolves
a derived node's geometry, asks the scene. So dragging a box left its edge
anchored to the pre-drag position until the drop, when the commit invalidated
the dependents and the edge jumped.

The three actions now also publish each frame into the scene's ephemeral pose
overrides (`syncPreviewOverrides` / `dropPreviewOverrides` in
`interactions/actions/previewOverrides.ts`). Overrides bypass `executeAndLog`,
so a drag still commits as exactly one undo entry — the reason the actions
avoided per-frame scene writes in the first place was history, and this writes
no history. Entries are set once and mutated in place, published with a single
`commit()` per frame.

Picking follows for free: the pick source resolves a derived path through its
own override-aware `poseOf`, so an edge is grabbable where it is drawn
mid-gesture rather than where it used to be.

`clone` is deliberately untouched — its previews are the new ghosts at the
drag target, and the originals never move, so nothing derives from a changed
pose.

Also closes the matching gap in the preview-ghost layer, which built a
container's clip with no derived path and so ghosted a derived container
without one.

Note for anyone with a hand-written `Scene` stand-in: `overrides` is now read
on every gesture frame. It was already required by the `Scene` contract, but a
partial fake that omitted it will now throw rather than silently skip.
