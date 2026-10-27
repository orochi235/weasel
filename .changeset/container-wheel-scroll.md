---
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/gestures': patch
---

The wheel scrolls a layout container whose content runs past its bounds, such as `tileGrid({ overflow: 'scroll' })`. `<SceneCanvas>` registers `containerScrollAction` (`container.scroll`) ahead of the wheel pan: over a container whose strategy's `contentExtent` reaches past its bounds, the wheel moves `scene.scroll`'s offset for it, clamped to that extent, and Shift+wheel scrolls it across; anywhere else it declines and the wheel pans the view. `scrollRange` and `scrollableAt` answer how far a container can scroll and which one is under a point. Hiding the overflow is the container's own `clip`. This adds API.

A wheel event now carries the world point under the pointer: `WheelEvent` gains optional `x`/`y`, `Action.enabled` is handed it, an immediate invoker's params carry it as `worldX`/`worldY`, and `InvocationCtx.world` holds it.
