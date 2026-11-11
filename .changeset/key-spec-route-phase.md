---
'@weasel-js/gestures': patch
---

`keySpecRoute` writes a key spec's `phase` into the route, as in `[engaged] keyDown(Delete)`, instead of always `[*:*]`. It returns `null` for a spec with a physical key `code` or more than one key, rather than a route that drops them; store such a spec as JSON.

<!-- entry: fix -->
