---
"@weasel-js/hud": patch
---

`attachMenuHost`'s detach gives focus back to the widget that held it when the open menu opened, as a close does. Detaching while a menu was open used to leave nothing focused, and a menu shown again by a later attach then gave focus back to nothing when it closed.
