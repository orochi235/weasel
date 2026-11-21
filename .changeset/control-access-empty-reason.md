---
'@weasel-js/ui-logic': patch
---

`controlAccess` reads an empty reason as none, so a control disabled with `reason: ''` leaves the tab order and shows no tooltip.

<!-- entry: fix -->
