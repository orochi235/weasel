---
'@weasel-js/menu': patch
'@weasel-js/hud': patch
'@weasel-js/ui': patch
---

Add `attachMenuDismiss` to `@weasel-js/menu`: it closes a menu on a press or wheel outside it, on the window losing focus, and on a resize, attaching to any `Window`-like target and returning a detach. `press: false` leaves out the press listener, and `keepOnBlur` keeps the menu open through a blur. ui's `ContextMenuHost` and hud's `attachMenuHost` both dismiss through it.
