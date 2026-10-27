---
'@weasel-js/routing': patch
---

An ongoing action can hand a pointer drag off mid-gesture: return `'pass'` from its handle's `onMove`, and the dispatcher cancels that handle and offers the drag, as it was pressed, to every other candidate in rank order. The taker starts as if it had won the press and then sees the move it was passed on; with no taker the drag ends. A drag never goes back to an action that passed it. Adds API: `OngoingHandle.onMove` may now return `'pass'`.
