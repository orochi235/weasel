---
'@weasel-js/core': patch
---

`insertAction` now runs `InsertBehavior`s, so `snapToGrid`, `snapToGuides` and `alignInsertBehavior` finally reach a drag. They ride the insert binding's `opts.behaviors`: pass `behaviors` to any drag-to-insert tool hook (`useRectTool({ behaviors })`, and the same on ellipse, line, polygon, star, pencil, text and image), or `toolOptions={{ insert: { behaviors } }}` on `<SceneCanvas>` for all of its built-in ones. Each behavior shapes the start and current point after Shift-constrain and the `snap` dep, and the live preview draws what it returns. On release the first `onEnd` to answer wins, as for move: `null` aborts the insert, `Op[]` commits in its place.
