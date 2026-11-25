---
'@weasel-js/routing': minor
'@weasel-js/core': patch
---

A drag from `useHandleDrag`, `startThresholdDrag` or `openPointerSession` cancels when the window loses focus, as a carry and the dispatcher's drags already did, instead of committing wherever the pointer comes back.

The session reports it as the new cancel reason `'blur'`; `openPointerSession(…, { blur: false })` keeps a session open across a blur.

<!-- entry: fix api behavior -->
