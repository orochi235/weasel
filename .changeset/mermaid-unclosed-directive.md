---
'@weasel-js/diagram-formats': patch
---

A Mermaid file with a `%%{` directive never closed is refused with a line error, as an unclosed `accDescr` block is, rather than read as empty.

<!-- entry: fix -->
