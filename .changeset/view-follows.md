---
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

`<CanvasView follows>` names a view whose layers this one paints and picks, read at every paint and pick, while it keeps its own rect and camera. Where that view owns a selection, this one acts on it and draws its chrome. A loupe that is a view follows whichever view is under its aim, so a lens over a `<CanvasView>` panel no longer shows or picks a layer the panel hides, and a press in it selects into the panel's own selection where the panel has one.
