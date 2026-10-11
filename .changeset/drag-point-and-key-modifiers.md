---
'@weasel-js/core': patch
---

`dragPointOf(event, element, view?)` turns a pointer event into the `DragGesturePoint` the drag gesture hooks take, for code feeding them from raw pointer handlers. `useKeyModifiers()` re-renders with the modifier keys held. `KeyState.modifiers()` now returns the same object until a modifier changes, so it works as a `useSyncExternalStore` snapshot.
