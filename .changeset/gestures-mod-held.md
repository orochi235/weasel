---
'@weasel-js/gestures': minor
---

New `modHeld(e)` and `modKey()`: whether an event holds `mod`, Command on an Apple platform and Ctrl elsewhere, and which of the two that is.

`matchModifiers`, `keysHeld` and the binding capture already read `mod` this way; these let a component's own handler read it the same way rather than testing `metaKey` and `ctrlKey` itself.

<!-- entry: api -->
