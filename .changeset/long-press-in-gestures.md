---
'@weasel-js/gestures': minor
'@weasel-js/core': minor
'@weasel-js/routing': patch
---

The long-press store and the press ring's model live in `@weasel-js/gestures`

`createLongPressStore`, `LongPressState`, `LongPressStore` and `PendingLongPress` are now defined in gestures; routing and core still export them. New beside them: `pressRingAt(state, now, opts)` gives the ring a held press shows at a moment, as its center, radius, width and fill, or `null` before the delay or for a press that will fire nothing. `pressRingWaitAt` says how long until it shows, and `ringArcPoints` gives the filled arc as points. Core's `createLongPressFeedbackContribution` draws that ring and keeps only the canvas part: its layer, its color, and reading `prefers-reduced-motion`.

<!-- entry: api -->
