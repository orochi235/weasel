---
'@weasel-js/diagram': patch
---

Several `<DiagramView>`s on one page register the diagram painters without conflict: `registerDiagramShape()` and `registerMarkShape()` with no options share one painter.

<!-- entry: fix -->
