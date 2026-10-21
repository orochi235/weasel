---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

A keymap's leader triggered without a key can now hold its keymap open:
`trigger('keymap.<id>', { hold: true })` keeps it open through any number of
inputs until Escape, where a plain `trigger` still opens it for one input.
`KEYMAP_HOLD` is the `heldBy` such a level reports.
