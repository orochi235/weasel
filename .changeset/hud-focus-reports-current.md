---
"@weasel-js/hud": patch
---

A HUD stops passing a focus report on once a listener has moved focus past it, so later listeners hear only the newer focus. `attachMenuHost` keeps open a menu a focus listener just opened, and the live region, the accessibility mirror and the text input follow the widget that holds focus.

<!-- entry: fix -->
