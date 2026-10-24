---
"@weasel-js/text-dom": patch
---

`useTextEdit`'s `onDraft` now fires when a restyle changes the overlay, as well as on each keystroke, so a style change mid-edit — Cmd-B over a selection, or a character panel's change — reaches a text-along curve at once instead of at the next keystroke. A draft carries `style` when the edit rewrote the node's own style, as a commit would. A draft is sent only when what the overlay holds changed, so styling armed at a collapsed caret, or a restyle that changes nothing, sends none.

`TextEditDraft` is now another name for `TextEditCommit`, since a draft is what a commit would write: its `runs` is a plain `StyledRun[]`.
