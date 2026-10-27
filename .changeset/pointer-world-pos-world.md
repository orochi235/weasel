---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/minimap': patch
'@weasel-js/labkit': patch
'@weasel-js/path-tools': patch
---

Breaking: `PointerWorldPos`, the pointer store's value, is `{ world: WorldPoint; viewId }` in place of `{ worldX, worldY, viewId }`. Read `p.world.x` where you read `p.worldX`, and publish with `store.set({ world: { x, y }, viewId })`. `useClipboardOps`' own `getDropPoint` option keeps its `{ worldX, worldY }` shape. When that option is left out, the paste point read from the pointer store no longer carries the store's `viewId` along with it.
