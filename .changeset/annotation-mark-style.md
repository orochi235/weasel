---
'@weasel-js/labkit': minor
---

Annotation marks have a width, a color and a text size of their own, which the lab's drawing tools set.

`AnnotationData`, `AnnotationInit` and `AnnotationPatch` take `width` (in the target's units), `color` and `fontSize`; a mark without them draws as before. A status's color still wins over the mark's own. An arrow's head grows with its width. The drawing tools share one width and one color, kept in the lab's records so they survive a reload.

<!-- entry: new api data -->
