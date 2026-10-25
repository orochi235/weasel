---
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
---

Two Follow lenses in the workshop each keep their own reticle: moving the focus from one to the other no longer snaps the first back to its pinned pose. A lens's held pose is let go when it closes or leaves Follow, by an action or by an undo or redo.

`LensActionApi.unfollow` now takes the lens id, so a host lets go of that lens's hold alone. This is a breaking change for a host implementing its own `LensActionApi`.
