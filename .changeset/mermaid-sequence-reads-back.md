---
'@weasel-js/diagram-formats': patch
---

A Mermaid sequence participant whose id is not a plain name, or is `title`, is renamed and keeps its text as the label.

A blank participant label is dropped with a warning instead of writing `A as`.

<!-- entry: fix -->
