---
'@weasel-js/svg': patch
---

`serializeSvg` writes a text node's `lineHeight` as `data-weasel-line-height` whenever the style sets one, and import reads it back. A single line used to lose it, since only the pitch between lines stated it. Where the lines' pitch disagrees with the attribute, as after another editor moved them, the pitch wins.
