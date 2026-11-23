---
'@weasel-js/paint': patch
---

Without `CSS.supports`, `parsesAsColor` takes a `color(srgb …)` or `color(srgb-linear …)` value only where `parseColor` reads it, so the two agree on malformed channels.

<!-- entry: fix -->
