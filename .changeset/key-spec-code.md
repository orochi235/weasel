---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

A key binding can name the physical key. `KeySpec` and `KeyHeldSpec` take a `code` (`KeyboardEvent.code`, one or several), tried before `key`, with either one matching; key input events carry the code. Bring to Front and Send to Back on Cmd+Alt+] and Cmd+Alt+[ use it, so they fire on layouts where Option makes those keys type something other than the US glyphs. A held key is now tracked by its code, so with both Shift keys down, releasing one no longer ends a Shift hold.
