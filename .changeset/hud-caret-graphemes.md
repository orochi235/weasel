---
"@weasel-js/hud": patch
---

Typing into a HUD menu's text row, the arrows, Backspace, Delete, and a click move or delete by grapheme cluster, so the caret no longer lands between a letter and its mark or inside an emoji sequence; offsets stay code-point offsets.
