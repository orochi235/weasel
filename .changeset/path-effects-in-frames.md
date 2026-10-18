---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

A derived node inside a container that composes frames paints where its dependencies are painted. Its path is drawn from their world poses, and the walk used to turn it again by the container's rotation; it now turns by the node's own rotation only. A derivation is handed each dependency's pose in the frame of the node deriving, so a path effect, or any `derivePose`, over shapes in another container boxes itself where it paints. `derivedDepOf(source, id, reader)` reads a dependency the way `reader`'s derivation does, and Expand to Paths uses it, so an effect across containers expands where it is drawn.
