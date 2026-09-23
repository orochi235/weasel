---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

`useOngoingAction(actionId)` lets a UI control — a color picker, a slider, a swatch — drive an ongoing action the way a drag does: `input(params)` opens the action on the first call and moves it on the rest (the live preview), `commit(params?)` ends it as one undo entry, and `cancel()` drops it. A commit with nothing open is a whole edit on its own, which is what a click on a swatch is. An edit still open when the control unmounts or its action id changes is committed. It wraps `ActionsRegistry.begin`, whose begin-or-update-then-end bookkeeping every such control used to hand-roll around a ref; `SceneGradientHandles` now uses it.
