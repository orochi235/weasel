---
'@weasel-js/core': patch
---

A `momentum` coast under the move action records one `flick` entry, where it used to record a `setPose` entry every frame and one undo stepped back a single frame. The coast is shown through the scene's pose overrides and written to the document once, when it comes to rest or a new drag catches it, through the `applyOps` dep when one is wired. `MoveAdapter` gains an optional `previewPoses`, which shows nodes at poses without writing the document; the move action's adapter provides it along with `applyOps`.
