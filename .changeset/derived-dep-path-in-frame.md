---
'@weasel-js/core': patch
---

A derivation reading a dependency in another frame now gets that dependency's derived `path` carried into its own frame, as its pose already was. Under a composing strategy, an effect whose source is another effect in a different container — copies along a blend's steps, say — now follows that effect where it paints rather than where its own container would put the path's local coordinates. A derived dependency's path is also drawn from its own dependencies as read in its frame.
