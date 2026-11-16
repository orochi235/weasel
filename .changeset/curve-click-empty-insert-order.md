---
"@weasel-js/ui": patch
---

A function layer's click-empty insert keeps the curve's x order under `constrain: 'function'`, and never adds a point past a pinned endpoint.

In `'2d'` the new point goes in just before the last endpoint; in an x-ordered curve a press outside the endpoints adds nothing.

<!-- entry: fix -->
