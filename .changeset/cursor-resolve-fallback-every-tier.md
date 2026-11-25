---
'@weasel-js/cursor': patch
---

`resolveCursor` throws a `RangeError` for a `fallback` holding `;`, `{` or `}` on every tier, a spec that resolves painted included, so a spec's size no longer decides whether it is valid.

<!-- entry: fix -->
