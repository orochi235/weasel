---
'@weasel-js/diagram-formats': patch
---

Reading a Mermaid flowchart keeps the styles after `linkStyle … interpolate <curve>` and warns that the curve was dropped.

The curve words had been read as part of the first property's name, which lost the stroke color.

<!-- entry: fix -->
