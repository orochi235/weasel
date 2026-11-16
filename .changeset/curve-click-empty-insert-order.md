---
"@weasel-js/ui": patch
---

A function layer's click-empty insert keeps points in x order under `constrain: 'function'`, and keeps pinned endpoints first and last: in `'2d'` the point goes in before the last endpoint, and in an x-ordered curve a press outside the endpoints adds nothing.

<!-- entry: fix -->
