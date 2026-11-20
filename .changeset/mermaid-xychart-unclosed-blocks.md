---
'@weasel-js/diagram-formats': patch
---

The Mermaid xychart reader throws, naming the line, on a `%%{` directive or `accDescr {` block that is never closed, as the other kinds do.

<!-- entry: fix -->
