---
'@weasel-js/hud': patch
---

`attachMenuHost(hud, host, …)` draws the open context menu as a HUD widget, from the same model the DOM menu uses: keyboard, typeahead, submenus and on-canvas placement. It takes focus while open, swallows every key pressed while it has focus, and closes when a press lands anywhere else. It does not yet draw icons, shortcut chips or check marks, and screen readers get only its name.
