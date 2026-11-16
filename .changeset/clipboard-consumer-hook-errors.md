---
'@weasel-js/editing': patch
---

The clipboard logs a `console.error` when your `produceFlavors` or paste `reviver` throws, instead of failing quietly.

The copy stays in memory and the paste is declined, as before; a browser without clipboard access, or another app's malformed text, is still only noted in the debug log.

<!-- entry: fix -->
