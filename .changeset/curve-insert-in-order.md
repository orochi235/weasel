---
'@weasel-js/ui': patch
---

A press on an ordered curve adds its point between the two anchors it lies between, even beside a steep segment.

An ordered curve is one with `constrain: 'function'` or `domain: '1d'`.

<!-- entry: fix -->
