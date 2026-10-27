---
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

`<CanvasView follows>` names a view whose layers this one paints and picks, read at every paint and pick, while it keeps its own rect and camera. A loupe that is a view follows whichever view is under its aim, so a lens over a `<CanvasView>` panel no longer shows or picks a layer the panel hides. It still acts on the canvas's selection where the panel owns one.
