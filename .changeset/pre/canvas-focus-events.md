---
'@weasel-js/core': patch
---

Forward `onFocus` and `onBlur` from the canvas element

The canvas is focusable by default (`tabIndex` 0) but exposed no way to
observe focus, so consumers driving focus-dependent chrome had to attach a
listener to an ancestor and infer it. Both are now props on `CanvasProps`, and
so reach `SceneCanvasProps` and the canvas element unchanged.
