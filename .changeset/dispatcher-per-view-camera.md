---
'@weasel-js/core': patch
---

Give each of `useGestureDispatcher`'s view records its own camera.

A record may now carry a `ViewApi`. An event routed to it dispatches against
the canvas dep registry with the `view` dep — and only that dep — replaced by
the record's, so `viewport.dragPan` and the rest of the viewport actions move
the view the gesture began in rather than the whole canvas. No second `setView`
channel was needed: every viewport action already reads its camera from that
dep.

This is what makes routing correct rather than merely wired. Records without a
`ViewApi`, which is every record today, resolve `view` exactly as before.
