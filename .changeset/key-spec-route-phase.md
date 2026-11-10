---
'@weasel-js/gestures': patch
---

`keySpecRoute` writes a key spec's `phase` into the route (`[engaged] keyDown(Delete)`) instead of always `[*:*]`, and returns `null` for a spec with a physical key `code` or more than one key, rather than a route that silently drops them. Store such a spec as JSON.
