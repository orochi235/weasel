---
'@weasel-js/diagram': patch
---

`createSpecRouter` leaves an edge whose end offers no facing port as it is, as a live scene's avoid routing does, instead of marking it `avoid` and dropping its route.

<!-- entry: fix -->
