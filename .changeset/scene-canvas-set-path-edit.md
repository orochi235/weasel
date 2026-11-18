---
'@weasel-js/core': minor
---

`SceneCanvasApi.setPathEdit` opens a path in anchor edit, or closes the open one, from outside a gesture.

`api.setPathEdit({ id, anchors })` opens `id` as a double-click would and selects `anchors`; `api.setPathEdit(null)` closes it. It takes the same value as `defaultPathEdit`, which applies only on mount, so a host returning a document to how it opened passes that value again.

<!-- entry: api new -->
