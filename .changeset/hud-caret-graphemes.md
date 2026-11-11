---
"@weasel-js/hud": patch
---

A HUD menu's text row moves and deletes by grapheme cluster, so the caret never lands inside an emoji or between a letter and its mark. The arrows, Backspace, Delete and a click all work this way; offsets stay code-point offsets.

<!-- entry: fix -->
