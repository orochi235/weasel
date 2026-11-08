---
'@weasel-js/core': patch
'@weasel-js/history': patch
---

Fix scene and history edge cases found in a fourth audit pass:

- Canceling a journal also cancels a suspended journal opened inside it, committing one refuses while such a journal is open, and `resumeJournal` resumes a nested journal inside its active parent.
- Undoing a delete restores the node as it was when removed, not the copy the op was built from.
- `jumpToHistoryIndex` with a fractional or NaN index returns `false` and notifies no one.
- `loadState` with a snapshot that cannot be built throws without wiping the current document or its history.
- A coalesced history entry keeps every id it touched across `serialize` and `restore`.
- Undo and redo skip a hide or lock of a node an untracked edit removed, instead of throwing.
