---
'@weasel-js/text-tools': patch
---

Converting a text node with `overflow: 'clip'` to outlines keeps only the glyphs inside its box, cut at the box edge, as the node draws them.

<!-- entry: fix -->
