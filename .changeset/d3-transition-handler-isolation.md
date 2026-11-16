---
'@weasel-js/d3': patch
---

A transition's `on('start' | 'end' | 'interrupt')` handler that throws no longer keeps the other handlers from running or `end()` from settling; the error goes to `console.error`.

<!-- entry: fix -->
