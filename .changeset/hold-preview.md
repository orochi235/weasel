---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`holdPreview(action)` makes an action a hold, under `holdPreviewId(action.id)`: bound to a `held(…)` key, in a keymap or anywhere, the press shows the action's `preview`, the release runs it, and a cancel (Escape, through core's cancel-gesture action) takes the preview down and runs nothing. The binding's params reach both. Nothing binds one yet; a Pathfinder key is the next step.
