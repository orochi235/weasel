---
'@weasel-js/core': patch
---

A node's path can be derived from other nodes' poses

A node declares `dependsOn: NodeId[]` and a `derivePath` function resolved by key
through `SceneRegistry`, and the scene walks resolve its path before painting
rather than it being authored. An edge drawn between two boxes is then an
ordinary scene node — selectable, styleable, exportable — whose geometry never
enters undo history. The seam and its traps are in `docs/extending.md`.

New surface: `scene.removeMany(ids)`; `dependsOn` and `derivePath` on
`NodeBase` and on `AddNodeSpec`, which is what a consumer writes;
`SceneRegistry.derivePath`; `SerializedNode.dependsOn` and
`SerializedNode.derivePathKey`, both additions to the serialization format;
`NodePaintCtx.derivedPath`.

Deleting a node now deletes everything that derives from it, transitively,
including those nodes' own subtrees, in one undo entry — so `scene.remove` can
remove nodes anywhere in the tree that the caller never named, and `removeLayer`
reaches nodes on other layers. Undo after the built-in **Delete** key does not
yet restore the cascaded nodes; see "Derived geometry follow-ups" in
`docs/TODO.md`.

**Breaking: `defaultDrawOne` takes `(node, pose, view?, ctx?)`.** The paint
context moves to a fourth parameter, so a call passing a `NodePaintCtx` third is
now a type error rather than a silent slide into the `view` slot. The same
fourth parameter is added to the `SceneViewDrawOne` and `SceneSlotConfig.drawOne`
callback types, which is not a break: an existing three-parameter implementation
still satisfies them, and an existing three-argument call still compiles.

**Breaking: `Scene` gained a required `removeMany`.** A hand-written object
typed as a `Scene` — a test double, most likely — no longer typechecks until it
implements it.

**Breaking: `kit:remove`'s op payload changed shape.** `rootId` / `parent` /
`index` became `detached: { id, parent, index }[]`, because a cascaded dependent
is not a descendant of the removed node and the tree has to be told about every
subtree that came out of it. A history persisted by an older build now throws
mid-undo rather than degrading. The break is deliberate; kit op payloads are not
versioned.
