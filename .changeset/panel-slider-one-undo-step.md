---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A slider dragged in a `SelectionPanel` or a selection `Bar` leaves one undo step, back to where each node was before the drag. Every move used to be a step of its own. The moves are still written to the scene as they happen, through `scene.untracked`, so the canvas follows the thumb.

Additive: a `PropertyRenderContext` carries `drafts`, a `setValue` and `update` for the values on the way to the one an edit settles on, which a custom renderer with a drag of its own can write through; `withDrafts` and `liveControl` sit beside `withCommitPolicy`. `PARAMS_TEXT_WAIT_MS` says how long typed text waits before a live write on each surface, and labkit's `ControlPanel` reads its 150 ms from it.
