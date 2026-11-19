---
'@weasel-js/clock': patch
---

A clock whose registration another under its id shadows keeps playing under `useClockLoop`. The registry's `all()` and `targets()` include shadowed registrations.

<!-- entry: fix behavior -->
