---
"@weasel-js/hud": patch
---

A HUD menu's text row types a key that is one grapheme cluster of several code points, such as an emoji with a skin tone, which it used to drop. Moving or deleting by a word in it stops at a cluster boundary, so Option+Delete after a letter with a skin tone, or after a space carrying a combining mark, no longer leaves half the cluster behind.
