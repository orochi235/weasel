---
'@weasel-js/ui': major
'@weasel-js/ui-canvas': minor
---

Scene panel helpers move from `@weasel-js/ui` to `@weasel-js/ui-canvas`, and `classifyKind` is gone.

The helpers are `useSceneLayerList`, `SceneGradientHandles`, `aggregateValue` (renamed `sharedNodeValue`) and `nodeValueAt`.

This is breaking: import `useSceneLayerList`, `ANNOTATION_LAYER_ROW` and their types from `@weasel-js/ui-canvas/components/SceneLayerList`; `SceneGradientHandles`, `SceneGradientHandlesProps` and `PaintedNodeData` from `@weasel-js/ui-canvas/components/SceneGradientHandles`; and `sharedNodeValue`, `nodeValueAt` and `AnyNode` from `@weasel-js/ui-canvas`. In place of `classifyKind(node, routing)`, call core's `routeKind(routing, node.data, node)`, which it wrapped. ui's `LayerList` and `GradientHandles` stay in `@weasel-js/ui`.

<!-- entry: breaking api -->
