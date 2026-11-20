---
'@weasel-js/react': patch
---

A `useVisibleRaf` loop given its own `requestFrame` and no `cancelFrame` no longer cancels an unrelated window animation frame.

<!-- entry: fix -->
