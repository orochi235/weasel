---
"@weasel-js/core": patch
---

`<SceneCanvas selectTool={{ rotate: false }}>` now turns off only the select tool's rotation: the
selection's rotation handle is hidden and bound to nothing. The `rotate` action stays registered, so a
tool of your own that binds `rotate` turns the selection, and a partial `actions.rotate` merges onto
the kit's action as it does on any other canvas. A `chromeVisibility` rule that shows the handle again
shows a handle a drag does nothing on, with no dispatcher warning. Before, the action was muted on the
whole canvas, which also stopped a consumer's tool from rotating.
