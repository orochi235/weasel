---
'@weasel-js/core': patch
'@weasel-js/history': patch
'@weasel-js/menu': patch
---

The select tool reads a `'single'` press as a replace rather than as an extend-click, so `extendClickLocked` no longer refuses one. `beginJournal`'s `coalesceWindowMs` takes a function, as `createHistory`'s does. A menu arrow key that leaves the highlight where it was no longer notifies subscribers or clears the typeahead buffer.
