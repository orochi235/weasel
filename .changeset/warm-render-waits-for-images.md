---
'@weasel-js/core': minor
---

`warmRender` waits for the pictures a render draws, so an export issued after it draws them rather than placeholders.

Image nodes and image patterns alike, an SVG at the size the render draws it. A picture that fails to load does not reject: it draws as failed. `renderNeeds` gains `images`, the pictures its commands' image patterns tile.

<!-- entry: rank=10 fix api -->
