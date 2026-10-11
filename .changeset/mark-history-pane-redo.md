---
'@weasel-js/labkit': patch
---

A redo run on one annotation target's scene directly, as a pane's own keymap does, no longer clears the redo order across targets: the toolbar's Redo stays enabled while another target still has one. `HistoryScene` gains `historyEntries()`, which the ordering reads to tell a redo from a new change by entry id; a `Scene` already has it.
