---
'@weasel-js/hud': minor
---

A HUD list given a `height` shorter than its rows clips them to its bounds and scrolls, so every row it draws can be pressed.

The wheel scrolls it, and the keyboard's row is kept in view; the list claims the wheel only while it has rows to scroll to. `ListWidget.scrollTop` reads the scroll, and `HudListState.scrollTop` sets it for `hudItemList.draw`.

<!-- entry: fix api -->
