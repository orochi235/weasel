---
"@weasel-js/core": patch
---

Two more readers resolve an `'inherit'` fill or stroke against a node's containers. The preview ghost of a gesture paints a member with the paint its containers are taking mid-gesture, so a container's fill edited during a drag reaches its members at once rather than at the commit. And culling measures an inherited stroke as the stroke it takes instead of declining to bound the node: `defaultPaintBounds` and `PaintBoundsFn` take an optional fourth `ctx` with `inherited`, which `<SceneCanvas>` and the headless render fill in from the scene. A `drawOne` wrapped by `withInheritedPaints` now keeps a `ctx.inherited` its caller passes.
