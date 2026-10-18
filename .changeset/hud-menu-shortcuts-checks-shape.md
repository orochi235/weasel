---
'@weasel-js/hud': patch
---

The WebGL context menu draws each row's shortcut at the row's end, in the muted color and formatted as the DOM menu formats it, and a check mark in the icon column for a row whose action is on, so a toggle's state shows. A panel widens to fit a label and its shortcut. Panels are rounded by `--wzl-radius-md` and cast the DOM panel's default shadow in `--wzl-shadow`. Icons are not drawn yet.
