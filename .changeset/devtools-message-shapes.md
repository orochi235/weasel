---
"@weasel-js/core": minor
---

The page's devtools session refuses a posted message that is not a protocol message, and `isPanelMessage` and `isPageMessage` tell one apart.

A request of the wrong shape is answered with an `error` naming its type; a value that is not an object is ignored. Both are exported from `@weasel-js/core/devtools-protocol`.

<!-- entry: api fix -->
