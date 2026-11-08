---
'@weasel-js/core': patch
---

Fixes from an audit of core's interactions:

- Group puts the new group where its frontmost member stood, and keeps its members' stacking whatever order they were selected in. It used to raise the group over every sibling, so content that stacked above the members ended up under them.
- A nudge, Transform Again or Move By that a transform follower refuses is no longer recorded for Transform Again, and neither is a duplicate the scene refuses.
- A click-to-place that places nothing puts back the selection it cleared, as a drawn insert does.
- `useHandleDrag` ignores a right or middle mouse press, so a right click on a gradient handle no longer drags it.
- A marquee or lasso dep's `targetOf` is called with the hit id alone.
