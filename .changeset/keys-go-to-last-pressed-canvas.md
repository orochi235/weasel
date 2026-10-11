---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/react': patch
---

A key or a paste that reaches the page now goes to the canvas the user last pressed or scrolled in, across every provider on the page, and to no canvas before the first such interaction. A lone canvas used to take every key from the moment it mounted, so a read-only canvas in a side panel took Space from the page around it. This changes behavior for every canvas: its shortcuts do nothing until it is pressed or scrolled in. An app whose canvas is the page passes the new `<SceneCanvas claimKeys>` (`claimKeys` on `useGestureDispatcher`) to take the keys on mount. A press gives a canvas the keys with any button and whichever channels are on; a dispatcher with no canvas element still follows the active input scope. `ActionsRegistry` gains `holdsKeys()` and `dropKeys()`, which a hand-built registry must now supply. For tests, `@weasel-js/react/testing/giveKeys` exports `giveKeys(canvas)` and `renderWithKeys`.
