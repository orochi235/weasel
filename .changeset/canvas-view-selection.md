---
'@weasel-js/core': patch
---

Give `<CanvasView>` a selection of its own.

`selection` and `selectionOptions` on a view mirror the props of the same name
on `<SceneCanvas>`: supply a `SelectionApi` to control one, or pass
`selectionOptions` to have the view build its own. Either goes into the view's
dep overlay, so an action dispatched inside that view reads and writes the
view's selection and leaves the surface's alone. Pass neither and the view
shares the surface's selection.

Nothing paints it yet — a view's chrome is still drawn from the surface's
selection.
