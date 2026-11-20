---
'@weasel-js/renderer': minor
---

`registerPaintDrawKindLoader` takes a `has` option saying whether the kind has landed.

Pass it when `register` fills a registry of your own, so a draw half registered elsewhere does not stop the load. It defaults to whether the draw half is registered.

<!-- entry: api -->
