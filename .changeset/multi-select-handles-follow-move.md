---
'@weasel-js/core': patch
---

Multi-select corner and rotation handles now follow the selection after a group
move. They used to stay where the union had been, so the next drag on the real
corner moved the set instead of resizing it. `ChromeState.unionBounds` is now
computed again on every read instead of being cached for the life of the state.
