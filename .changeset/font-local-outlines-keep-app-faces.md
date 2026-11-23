---
'@weasel-js/font': patch
---

`enableLocalFontOutlines` leaves an outline face the app registered itself in place, and counts it in the result's new `kept`; pass `replace: true` to have installed faces replace it.

<!-- entry: fix api behavior -->
