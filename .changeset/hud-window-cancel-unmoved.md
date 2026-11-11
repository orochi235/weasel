---
"@weasel-js/hud": patch
---

A HUD window's drag that is canceled where it began reports nothing. A drag moved away and back used to report a move or resize to the bounds it already had, and mark its frame changed, when canceled.
