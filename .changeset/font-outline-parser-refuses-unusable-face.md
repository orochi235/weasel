---
'@weasel-js/font': patch
---

The default outline parser rejects a font that states no units per em (no `head` table) or no ascent (neither `hhea` nor `OS/2`), so its text keeps rendering from the SDF tier. Such a font used to load as a face whose advances and ascender were all `NaN`.
