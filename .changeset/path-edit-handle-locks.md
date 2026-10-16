---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Path edit's handle drags gain a length lock beside the angle lock. Mod (Cmd or Ctrl) held while dragging a control handle keeps its length and changes only its angle, as Shift keeps its angle and changes only its length; both together freeze it. The lock in force draws what it holds the handle to — the line, or the circle round the anchor — as a `polyline` overlay of the new `lock` role.

Two toggle actions, `handleLock.angle` and `handleLock.length` (group `anchors`, no default binding, in the `paths` preset), hold a lock for every handle drag without a modifier. They set `handleLocks` on the `editAnchors` dep, which `EditAnchorsDep` gains with `setHandleLocks`, so a bar, the command palette, and `<SceneCanvas tune>` reach one value: `editAnchors`'s new `handleLock: 'angle' | 'length'` param (`EditAnchorsParams`) is where the locks start until a toggle is pressed.

`@weasel-js/geom` adds `handleAtItsLength`, the length-holding counterpart of `handleAlongItsAngle`.
