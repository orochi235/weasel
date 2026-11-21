---
'@weasel-js/diagram-formats': patch
---

The Mermaid sequence writer drops a box or region fill Mermaid would not read as a color, with a warning. A box filled `var(--brand)` keeps its label.

<!-- entry: fix -->
