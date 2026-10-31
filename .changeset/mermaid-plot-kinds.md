---
'@weasel-js/diagram-formats': patch
---

`DIAGRAM_MERMAID` reads and writes `gantt`, `timeline`, `pie`, `quadrantChart`, `journey`, `gitGraph`, `sankey-beta`,
`packet-beta` and `radar-beta` diagrams, each as one plot page holding that kind of chart; writing a plot page picks
the Mermaid kind from its chart's kind. Each reader names the line of an error and warns of what it drops. This adds
API.
