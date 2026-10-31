---
'@weasel-js/diagram': patch
'@weasel-js/diagram-formats': patch
---

A `DiagramType` names the `notations` its graph pages are written in: UML class `class`, ERD `er`, mind map
`mindmap`, flowchart `FLOWCHART_NOTATION`. `diagramNotationOf` gives the one a scene's type writes, and
`diagramTypeOfNotation` the type a notation opens as. `documentFromScene` gives a graph page with no notation of its
own the one its scene's type writes, so a chart drawn as a UML class diagram exports as a Mermaid `classDiagram`;
`documentSpecs` emits `diagram:type` when every graph page's notation names one type, so an imported class diagram
opens with the UML stencils. A page whose notation is `FLOWCHART_NOTATION` writes as a flowchart in a chart of
another type. This adds API.
