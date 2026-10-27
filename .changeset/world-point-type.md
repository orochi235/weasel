---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`WorldPoint` names the space the dispatcher's `clientToWorld` maps the pointer into: the world on a 2D canvas, the pane's screen point under the identity mapping a camera-bearing host passes. `InvocationCtx.world`, `drag.start`, `drag.current`, `DragSample`, the dispatcher's `onClick`, `onDoubleClick`, `affordanceAt`, `classifyTarget` and `clientToWorld`, and the point payloads of the `nodeAtPoint`, `lassoSelect`, `insert` and `snap` deps are typed with it. It is an alias of `Point2`, so nothing that type-checked before stops.
