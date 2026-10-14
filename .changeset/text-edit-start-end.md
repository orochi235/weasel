---
'@weasel-js/text-dom': patch
'@weasel-js/core': patch
---

Additive: `useTextEdit` and `useSceneTextEdit` take `onStart(id)` and `onEnd(id)`. `onStart` is called as an edit opens, whichever way it was started (`startEdit`, a double-click, the `textEdit` dep). `onEnd` is called as it closes, however it does: a commit, a cancel, Escape, a click away, or another edit opening over it, and after any commit has been written. Both are called from the call that changes the edit, not from an effect, so state that follows the edit is never a render behind it. Neither is called when the hook unmounts with an edit open.
