---
"@weasel-js/routing": patch
"@weasel-js/core": patch
---

When the canvas holding the keys unmounts, the keys now go back to the canvas used before it that is still mounted, including one that took them with `claimKeys`, instead of to no canvas. Closing a lightbox canvas that was pressed in no longer leaves the board beside it deaf to Cmd+Z until it is pressed again. Of two canvases on one actions registry, the first to unmount keeps the keys for the other, and a canvas whose listeners are bound again (a channel switched on or off) keeps them. A hand-built `ActionsRegistry`'s `dropKeys()` now means "leave the key order", called once the last canvas on that registry unmounts.
