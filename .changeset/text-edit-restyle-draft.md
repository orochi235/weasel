---
"@weasel-js/text-dom": patch
---

`useTextEdit`'s `onDraft` now fires when a restyle changes the overlay, as well as on each keystroke, so a style change mid-edit — Cmd-B over a selection, or a character panel's change — reaches a text-along curve at once instead of at the next keystroke. A draft carries `style` when the edit rewrote the node's own style, as a commit would. Styling armed at a collapsed caret changes nothing yet, and sends no draft.
