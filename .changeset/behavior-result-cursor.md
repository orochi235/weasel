---
'@weasel-js/core': minor
'@weasel-js/editing': minor
'@weasel-js/routing': minor
---

A move behavior can set the cursor a drag shows, by returning `cursor` from `onMove`.

The latest behavior to name one wins, and the drag falls back to the move action's own cursor when none does. The cursor follows a change a behavior makes with the pointer held still, such as a dwell timer arming, as soon as the gesture's handle says it changed.

<!-- entry: api new -->
