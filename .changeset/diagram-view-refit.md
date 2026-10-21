---
'@weasel-js/diagram': patch
---

`DiagramView` fits again when new specs run past what it shows, while the user has not panned or zoomed it, and `fit()` on the ref fits it on demand, even after they have.

A `DiagramOverlay` placed beside its target is kept inside the view when neither side of the target has room for it, rather than overflowing the near side.

`diagramScene`'s `nodeStyle`, `groupStyle` and `edgeStyle` may answer `undefined` to keep the default look, and the no-theme defaults are exported as `DEFAULT_NODE_STYLE`, `DEFAULT_GROUP_STYLE` and `DEFAULT_EDGE_STYLE`.
