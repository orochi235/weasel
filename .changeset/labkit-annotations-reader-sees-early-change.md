---
'@weasel-js/labkit': minor
---

Anything reading `useAnnotations()` shows a mark change made before it subscribed, such as one an effect makes on mount.

`AnnotationsApi` gains `version()`, which counts the notifications `subscribe` has sent. An object implementing `AnnotationsApi` by hand needs it too.

<!-- entry: fix api -->
