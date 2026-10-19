---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
---

Breaking at the type level for custom `commit` and `canConnect` callbacks: the ends of a `PendingEdge` and the arguments of `CanConnect` are now a `ConnectEnd`, which is a port or a shape's body, where they were always a port.

`@weasel-js/diagram` gains editing surface. Edges connect onto a shape's body (`connectBodies`, the `bodies` option, and a connector tool), and a selected edge's ends reconnect by dragging a handle. A label action (`editEdgeLabelAction`, `edgeLabelSpec`, `labelSize`) creates and edits an edge's label. Stencils (`FLOWCHART_STENCILS`) come with `useStencilInsert` and `useStencilTool`. `DiagramView` takes `onReconnect`, `onDelete`, `onEditLabel`, `connectBodies` and `ambient`, and its ref has `worldAt`. `diagramResizable` keeps resize handles off edges and labels. `DataEdge` and `EffectWire` take an optional `id`, and the `ellipse` outline is new. For effect pipelines there is an edit model, stage types with typed params, and `EffectEditor`, an editable node graph.

`@weasel-js/core` exports `createDeleteAction` and `commitDeleteToScene`, so a consumer can swap how a delete commits.
