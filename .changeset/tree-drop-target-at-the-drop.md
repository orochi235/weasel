---
'@weasel-js/ui': patch
---

Adds API: `Tree` takes a `dropRef`, filled with a `TreeDropHandle` whose `targetAt(point)` says where something dropped on the tree from outside it lands at a client point, or `null` where the tree takes nothing. It is the hit test behind the mark an `externalDrag` draws, run when asked, so it is right for a release in the same task as the last pointer move. `onExternalTarget` is written from an effect, a render behind the pointer, and read at such a release it named the previous row or none. `canDrop` is asked, with no ids, in the same call, so what it answers from has to be current then as well.

`PrefSchemaEditor` asks it for a drop from the palette, the unplaced list, and the actions list, where it forced a render before reading the target.
