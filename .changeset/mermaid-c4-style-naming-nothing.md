---
'@weasel-js/diagram-formats': patch
---

A Mermaid C4 `UpdateElementStyle` or `UpdateRelStyle` naming nothing declared above it is dropped with a warning.

`UpdateElementStyle` had thrown and failed the whole import, where Mermaid ignores it. `UpdateRelStyle` styles only the first relationship between two elements, as Mermaid does, and writing a C4 diagram warns that colors on a later relationship between the same two elements were dropped.

<!-- entry: fix -->
