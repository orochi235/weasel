---
'@weasel-js/diagram': minor
---

A `slot` row takes `image: { src, opacity? }`, and `diagramScene` fills the slot's box with it through the kit's image painter instead of drawing an empty frame; a slot with an image needs no `id`. `DiagramView` frees an image from the kit's image cache once its specs stop drawing it, and every image it draws when it unmounts, so a view whose pictures change often, a new data URL per edit, does not hold every one it has shown until the cache's byte budget runs out.
