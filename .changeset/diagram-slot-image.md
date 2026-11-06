---
'@weasel-js/diagram': minor
---

A `slot` row takes `image: { src, opacity? }`, and `diagramScene` fills the slot's box with it through the kit's image painter instead of drawing an empty frame; a slot with an image needs no `id`. When a node's image `src` changes, `DiagramView` gives it the last picture that node decoded as `image.previous`, so it keeps drawing that until the new one is ready. `DiagramView` frees an image from the kit's image cache once nothing needs it (a held-over picture as soon as its replacement has decoded), and every image it draws when it unmounts, so a view whose pictures change often, a new data URL per edit, does not hold every one it has shown until the cache's byte budget runs out.
