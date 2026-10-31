---
'@weasel-js/diagram-formats': patch
---

`DIAGRAM_MERMAID` reads and writes Mermaid class diagrams, state diagrams (`stateDiagram-v2` and `stateDiagram`), ER
diagrams, mind maps, and requirement diagrams as well as flowcharts. Reading sets the graph page's `notation` to the
kind (`'class'`, `'state'`, `'er'`, `'mindmap'`, `'requirement'`); writing picks the kind from it, a flowchart when it
is unset. Other Mermaid kinds are still refused with an error naming the kind.

A graph page can name the `layout` it is laid out with on import, any of `LAYOUTS` (a mind map reads as `radial`).
`documentFromScene` reads an edge's `endLabels` and a body's `field` rows back; draw-XML writes and reads end labels as
label cells at either end and maps the `start`, `end`, and `bar` outlines to draw.io's UML state shapes, and DOT writes
and reads them as `taillabel` and `headlabel`. This adds API.
