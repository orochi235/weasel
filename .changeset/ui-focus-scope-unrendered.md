---
'@weasel-js/ui': patch
---

`createDomFocusScope().tabOrder()` leaves out elements CSS does not render, under `display: none` or `visibility: hidden`, as Tab does.

<!-- entry: fix -->
