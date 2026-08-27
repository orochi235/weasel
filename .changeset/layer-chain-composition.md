---
'@weasel-js/core': patch
---

Compose `before` and `after` layer chains in both directions

`composeOrderedLayers` walked the two anchor maps separately: a chain hanging
off an `after` anchor only followed further `after` links, and likewise for
`before`. A custom layer anchored `before: 'scene'` carrying a second custom
anchored `after` it dropped that second layer to the tail with a spurious
dangling-reference warning.

Both walks now emit a layer's `before` chain, the layer, then its `after`
chain, so the two mix freely. Cycle detection and orphan fallback are
unchanged.
