---
'@weasel-js/font': patch
---

The default outline parser rejects a font with no units per em or no ascent, so its text keeps rendering from the SDF tier. That is a font with no `head` table, or with neither `hhea` nor `OS/2`.

<!-- entry: fix visual -->
