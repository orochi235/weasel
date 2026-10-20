---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

Diagrams get containers and swimlane pools, and core's layouts and drops carry and filter nested nodes.

- core: a layout pass that moves a child container now takes that container's descendants along, under absolute poses, in the same edit; so does a layout drop that shifts siblings, in its preview and its commit. `carriedDescendants(source, root, translate)` and `sceneCarrySource(scene)` are the helper behind both. A new optional `canDropInto(parent, ids)` dep (`CanDropIntoDep`) decides which containers a move may drop into: reparent-on-drop passes over a refused container, the layout drop skips it, and a child leaving its layout container does not land in it.
- diagram: `CONTAINER_STENCILS` offers Container, Pool (rows), and Pool (columns). A container is a titled box whose members move with it and stay put when it is resized; a pool stacks lanes that reorder by their headers, resize by the boundary after each (`diagram.resizeLane`), and grow by the button past the stack (`diagram.addLane`). `diagram.releaseMembers` removes a container and keeps what it holds. `diagramCanDropInto(scene)` is the drop filter, `diagramContainers` returns the lane layer and the contribution, and `diagramContainerLayout` and `laneStackLayout` register through `withDiagramRegistry`. `useStencilInsert` takes `containers`, and a stencil drawn inside a container or a lane becomes its member. Lanes take no connectors, and `diagramResizable` refuses them.
- core: a container with a layout is arranged again whenever one of its children's poses is written — a nudge, an align, a panel edit — not only when its children or its size change, in the same undo entry as the write.
