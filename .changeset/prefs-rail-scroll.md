---
"@weasel-js/ui": patch
---

`PrefsDialog` in `layout="rail"` now scrolls its pane with no height from the
consumer. The pane is held to the modal's `max-height` and scrolls inside it,
and clicking a rail subentry scrolls the pane to that section. Before this fix
the pane grew to fit every row, the dialog cut it off, and subentry clicks did
nothing. A consumer height on `dialogClassName` still sets the size, so a
workaround like `block-size: min(88vh, 44rem)` can stay or go. This is a fix
only: no API changes.
