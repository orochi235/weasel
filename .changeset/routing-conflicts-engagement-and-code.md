---
"@weasel-js/routing": patch
"@weasel-js/gestures": patch
---

`findConflicts` and `reportRouteConflicts` catch more pairs of key bindings that fire on the same keystroke.

- Two owners' bindings that fire together only while one owner is engaged and the other idle, such as one owner's `engaged` binding against another's `initial` one on the same key.
- Key bindings whose `code`s overlap, whatever keys they name.
- A chord of a letter or digit against a binding naming the physical key that bears it, such as Mod+A against `code: 'KeyA'` under Mod, which both fire on a non-Latin layout.

A pair that meets on several keys or codes is reported once. `@weasel-js/gestures` exports `chordCodesFor` and `CHORD_MODIFIERS`, the matcher's own rule for this, and reads only `KeyA`–`KeyZ` and `Digit0`–`Digit9` as bearing a letter or digit.

<!-- entry: behavior api -->
