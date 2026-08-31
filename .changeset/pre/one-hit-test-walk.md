---
'@weasel-js/core': patch
---

Answer "can this node be hit" in one place

Four tree walks answered it separately — the generic-adapter point pick, the
one `<SceneCanvas>` installs, `sceneToAdapter`'s area walk, and the live
marquee/lasso — plus a fifth that shadowed the third. They agreed on every case
that had a test and disagreed on the rest, three times, silently. `pickWalk`
now owns every gate; a query supplies only its own shape test and the clip
predicate for its region.

Behavior that changes as a result:

- **A node painted at alpha 0 is no longer clickable.** The pick path reads the
  same number the painter does — the view's `alphaFor` times any per-node
  override alpha — so a node faded out of sight stops claiming clicks. The
  floor is exactly zero, so a fade-in is pickable from its first nonzero frame.
  Alpha is per view: dimming a node in one view leaves it pickable in another.
- **A layer that is not painted no longer claims pointer events.** `drawLayers`
  drops any layer missing from a supplied `layerOrder`, and the chrome hit path
  only consulted `layerVisibility`. Both gates now run through one
  `isLayerPainted`, which is exported.
- `sceneToAdapter`'s area walk reads override poses and hidden layers, which it
  did not; its default `poseBounds` answers a path pose instead of `NaN`, which
  is what the shadow walk existed to work around.
- An ancestor clip now rejects an area query that reaches into the clip where
  the node is not, or reaches the node where the clip is not — the two terms
  together, where one alone let false positives through.

`useSceneSelectTool` takes `alphaOf` and `layerIsPainted` for the asking view.
`passesAncestorClips` and its module are gone; `pickWalk`, `scenePickSource`,
`adapterPickSource` and `ownClipOf` replace them.
