---
'@weasel-js/diagram': patch
'@weasel-js/diagram-formats': patch
---

New diagram types State, Requirement, C4, Block, Architecture, and Kanban, with stencil groups `STATE_GROUP`,
`REQUIREMENT_GROUP`, `C4_GROUP`, `ARCHITECTURE_GROUP`, and `KANBAN_GROUP` whose shapes write as their Mermaid
constructs: a state's start, end, choice, fork, note, and composite and concurrent states; requirements and elements;
C4 people, systems, containers, components, stores, queues, and boundaries; architecture services by Mermaid's built-in
icons, junctions, and groups; a kanban board and its cards. Block diagrams draw with the flowchart's shapes on a grid.
A `DiagramStencil` can name a `themeRole`, kept on its trait and resolved by `StencilInsertOptions.theme`; a
`ContainerStencil` can name its `title` and its first `lanes`; `DiagramTypeEdge` takes a `dash`. A stencil's field
rows now carry `bodyField`, so they read back as fields. The Mermaid requirement writer names each block by its name
row rather than its id. This adds API.
