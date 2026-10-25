---
'@weasel-js/diagram': patch
'@weasel-js/ui': patch
---

Diagram types and stencil groups. A `StencilGroup` is a named list of stencils, and a `DiagramType` names the groups a new diagram opens with, the router and end markers its new connectors take, and the layout auto layout runs. `STENCIL_GROUPS` ships the `flowchart` and `containers` groups (`FLOWCHART_STENCILS` and `CONTAINER_STENCILS` are unchanged), and `DIAGRAM_TYPES` ships the `flowchart` type. A scene saves its type and shown groups under `DIAGRAM_TYPE_DOC_KEY`: `diagramTypeDocOf` and `diagramTypeOf` read it, falling back to flowchart, and `setDiagramType`, `addStencilGroup`, and `removeStencilGroup` write it as one undo entry each. `groupStencils`, `groupStencilIds`, `isContainerStencil`, and `diagramTypeEdgeStroke` serve a host building its palette and connector tool from them. `layoutDiagram` runs a layout from a graph source and applies it as one undo entry; `createLayoutAction` now goes through it.

`MenuButton` rows take `checked`, which draws them as check rows.
