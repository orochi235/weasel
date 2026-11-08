---
'@weasel-js/labkit': patch
'@weasel-js/react': patch
'@weasel-js/core': patch
---

Follow a lab tile that moves with nothing resizing

- A lab's surface re-measures a tile that moves while neither it nor the surface changes size, such as when a sibling beside it settles. An annotation's input box and marks used to stay where the tile was first measured.
- `watchElementMove(element, onMove)` is exported from `@weasel-js/react`. It calls `onMove` when an element's box moves in the viewport for a reason no event reports. It moved there from core, which exported it only for tests.
