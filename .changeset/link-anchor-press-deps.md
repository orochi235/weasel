---
"@weasel-js/path-tools": patch
---

Releasing an Alt-dragged anchor with `linkAnchor` under a real dispatcher now links it or moves it; it used to throw on release, because it read the scene from the release's context, which the dispatcher hands empty deps, and the drag was lost.
