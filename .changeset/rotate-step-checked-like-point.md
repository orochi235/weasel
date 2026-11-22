---
'@weasel-js/core': patch
---

A rotate's `constrain` step is checked as a point gesture's is: zero or non-finite throws under Shift, and a negative step still steps. `stepAngles` throws on such a step too.

<!-- entry: fix -->
