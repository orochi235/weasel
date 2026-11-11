---
"@weasel-js/hud": patch
---

A HUD passes no focus report on once a listener has moved focus past it. A listener that moved focus while hearing a change had every listener after it then hear the focus it moved away from, after the newer one, so `attachMenuHost` closed a menu a focus listener had just opened, and the live region, the accessibility mirror, and the text input could follow a widget that no longer held focus.
