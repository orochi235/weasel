---
'@weasel-js/core': patch
---

Breaking: the clipboard's paste point is a `WorldPoint` (`{ x, y }`), like the dispatcher's points, in place of `{ worldX, worldY }`. This covers `useClipboardOps`' `paste(at)` and its `getDropPoint` option, `ClipboardDep.paste`, and `PasteCtx.dropPoint`, which an adapter's `commitPaste` receives. Pass `{ x, y }` where you passed `{ worldX: x, worldY: y }`, and read `ctx.dropPoint.x` where you read `ctx.dropPoint.worldX`.
