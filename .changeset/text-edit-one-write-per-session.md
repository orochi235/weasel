---
'@weasel-js/core': patch
---

A text edit is one write. `useSceneTextEdit` committed text, runs, and a rewritten node style as separate `scene.update` calls, so one styled edit took two or three undos, and after the first the node held new text beside old runs, which `createTextLayer` throws on. It now makes one update. Turning off a flag the node itself sets (Cmd+I on a word in an italic node) also wrote the node's style at once, so a canceled edit still changed the node; `useTextEdit` now holds that style until the commit and calls `setStyle` then, if at all.

New surface on `useTextEdit`: a `commit(id, { text, runs?, style? })` option that takes the whole edit in one call in place of `setText` / `setRuns` / `setStyle` (`setText` is optional when it is given), the `TextEditCommit` type it receives, and a returned `nodeStyle`, the rewritten node style an edit is holding, for a control that shows the node's style mid-edit.
