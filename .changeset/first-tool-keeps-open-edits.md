---
'@weasel-js/routing': patch
---

Filling an empty tool slot no longer counts as a tool switch. A `<SceneCanvas>` with no `initialActive` seeds its first tool after mounting, and that used to cancel every live gesture and every `useOngoingAction` edit opened while the canvas mounted. Tools still hear `onActivate` when the slot is filled; only switching away from a tool ends what was in progress.
