---
'@weasel-js/svg': minor
---

`parseSvg` keeps each element's `id` on its node, and `serializeSvg` writes it back, so an animation or a stylesheet can name the node.

A copy a `<use>` draws takes the `<use>`'s own `id`, never the copied element's.

<!-- entry: new api data -->
