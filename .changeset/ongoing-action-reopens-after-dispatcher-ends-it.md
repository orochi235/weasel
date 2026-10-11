---
'@weasel-js/routing': patch
---

`useOngoingAction`: a control whose edit the dispatcher ended (a tool switch, Escape, or another control committing the same action) opens a new edit on its next `input()`, where it used to drop every input until it committed. `UiOngoingControl` gains a read-only `active` flag, false once its handle has ended by any route, so any driver of `ActionsRegistry.begin` can tell.
