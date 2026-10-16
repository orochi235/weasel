---
'@weasel-js/hud': patch
---

`attachMenuHost(hud, host, …)` draws the open context menu as a HUD widget, from the same model the DOM menu uses: keyboard, typeahead, submenus and on-canvas placement. It takes focus while open, swallows every key pressed while it has focus, and closes when a press lands anywhere else. It does not yet draw icons, shortcut chips or check marks, and screen readers get only its name.

A widget can now set `focusRing: false` to keep the HUD from drawing its focus ring around it; the menu does, since its highlighted row already shows where focus is. Menu labels are measured from the advances of the font the HUD draws in, and `measureLabel` is exported for a `measure` override to build on.
