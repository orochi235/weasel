---
"@weasel-js/ui": minor
---

An arrow key on a curve layer's mark moves that layer's mark even when another layer shares its id.

`onKeyDown`'s `KeyDownArgs` gains `group`, the element the layer draws into, so a custom layer can tell a key on its own marks the same way.

<!-- entry: fix api -->
