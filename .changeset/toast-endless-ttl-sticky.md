---
"@weasel-js/ui": patch
---

A toast whose `ttlMs` is `Infinity`, or longer than a browser timer can hold, stays until dismissed instead of closing at once.

<!-- entry: fix -->
