---
'@weasel-js/ui': patch
---

`createDomFocusScope`'s `moveFocus('prev')` enters a radio group with nothing checked at its last radio, as Shift+Tab does.

<!-- entry: fix -->
