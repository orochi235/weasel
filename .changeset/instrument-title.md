---
'@weasel-js/labkit': patch
---

An instrument can declare a `title`. A trial of it reads that title in its
title bar and `aria-label` until the trial is given one of its own, and
`setTitle(null)` returns to it; the header's "Add trial" menu lists instruments
by it too. Without a `title`, both read the instrument's `name` as before.
