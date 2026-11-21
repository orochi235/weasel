---
"@weasel-js/ui": patch
---

A `coffin` badge reads `shoulderHalfHeight` as the shoulder's own half-height, not as an increment over `headHalfHeight`.

Its default is now 50, which draws the same coffin as before. A caller who passed it as an increment over the head passes the sum instead.

<!-- entry: fix visual behavior -->
