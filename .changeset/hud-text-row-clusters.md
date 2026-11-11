---
"@weasel-js/hud": patch
---

A HUD menu's text row accepts a key that is a grapheme cluster of several code points, such as an emoji with a skin tone. Moving or deleting by a word in it stops at a cluster boundary.

<!-- entry: fix -->
