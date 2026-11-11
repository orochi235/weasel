---
"@weasel-js/routing": patch
"@weasel-js/gestures": patch
---

`findConflicts` and `reportRouteConflicts` report two more kinds of tie. One is between two owners' bindings that fire together only while one owner is engaged and the other is idle, such as one owner's `engaged` binding against another's `initial` one on the same key. The other is between key bindings whose `code`s overlap, whatever keys they name. A pair that meets on several keys or codes is reported once. A third is a chord of a letter or digit against a binding naming the physical key that bears it, such as Mod+A against `code: 'KeyA'` under Mod: a non-Latin layout's chord on that key fires both. `@weasel-js/gestures` exports `chordCodesFor` and `CHORD_MODIFIERS`, the matcher's own rule for that, and reads only `KeyA`–`KeyZ` and `Digit0`–`Digit9` as bearing a letter or digit.
