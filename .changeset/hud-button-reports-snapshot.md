---
"@weasel-js/hud": patch
---

A HUD button reports each press, hover and leave to the listeners it held when the report began. A listener that throws no longer stops the others hearing it or leaves the button drawn pressed; one that removes and re-adds itself while heard is not called again, and one added mid-report waits for the next.

<!-- entry: fix -->
