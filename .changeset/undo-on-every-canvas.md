---
'@weasel-js/core': patch
---

Every `<SceneCanvas>` and `<LeanSceneCanvas>` now has undo and redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z), whatever its `features`. They used to come only with the `edit` preset, so a canvas that moved shapes, edited anchors, or drew with the shape tools recorded history it could not step back through. `edit` no longer lists them; `BASELINE_ACTION_IDS` names the actions every canvas registers, and `<SceneCanvas actions>` still overrides or mutes them.
