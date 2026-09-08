---
'@weasel-js/core': patch
---

WeaselDraw's SVG export drops what a hidden layer holds, matching what the
pixel path draws. It walked the whole container tree with no visibility gate,
so hiding a layer and exporting produced a file with the hidden content in it.

`SceneSource` gains an optional `isPainted(id)`; a node it refuses is skipped
along with everything under it, under an explicit `roots` override too — a
selection naming a hidden node still must not export it. A source that omits
the predicate emits everything, exactly as before.
