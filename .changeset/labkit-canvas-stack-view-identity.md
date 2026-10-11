---
'@weasel-js/labkit': patch
---

In a lab with several canvas trials, any change to one trial (each frame of a pan, each job item, each saved mark) cleared and redrew every layer of every other trial. `CanvasStack` now treats a `view` with the same zoom and pan as the same view, whatever object carries it, so only a real view, size, or layer change repaints.
