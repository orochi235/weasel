---
'@weasel-js/forge': patch
---

The API panel parenthesizes a function type inside a union, so `((e: E) => void) | null` no longer reads as a function returning `void | null`.

<!-- entry: fix -->
