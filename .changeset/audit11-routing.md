---
'@weasel-js/routing': patch
'@weasel-js/gestures': patch
'@weasel-js/cursor': patch
---

Fixes to shortcut chips, tuned actions, UI-driven gestures, the `key()` sugar and cursor angles.

- `keySpecShortcut` and `actionShortcuts` give a key binding that requires `ctrl` or `meta` (without `mod`) no chip, as their docs say. Before, a Ctrl+Tab binding showed in menus and palettes as a bare `Tab`; an action bound that way now falls back to its next binding's chip, or shows none.
- An action tuned with `params` (`ActionsRegistry.tune`, or the last-operation panel's session params) now has its `enabled` and `active` asked with those params beneath the call's, as `run`, `preview` and `cursor` already were. A trigger, menu row or palette entry no longer reads a tuned action as disabled, or not pressed, for want of a param the tuning supplies.
- A handle opened by `beginUiOngoing` is out of flight before its `onEnd` runs, on `end()` and when a second `begin` auto-commits it, as a gesture's is. An `onEnd` reading the dispatcher no longer sees its own handle, and one that begins the same action again no longer has `onEnd` run twice.
- `key('+')` is the plus key; it threw that the shortcut names no key. `'Mod++'` already read this way.
- A cursor spec whose `angle` is NaN or infinite draws unrotated. Before, the baked cursor's hotspot read `NaN NaN`, so the browser dropped the cursor, and the painted tier drew nothing.
