---
'@weasel-js/history': patch
'@weasel-js/ui': patch
---

`createHistory`'s `coalesceWindowMs` also takes a function, called at each push, so the window can change after the history is made; a journal the history begins reads the same function. `PrefSchemaEditor` passes one, so a change to the `history.coalesceMs` kit setting reaches an editor that is already open instead of waiting for it to remount.
