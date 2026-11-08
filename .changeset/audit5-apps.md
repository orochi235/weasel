---
'@weasel-js/devtools': patch
---

- The History and Dispatch tabs key each row by its place in the canvas's ring, so a row you opened stays the one open: it no longer jumps to a neighbor once the panel's 200-row buffer starts dropping old rows, or lands on a new row after Clear.
- Flipping the History tab's checkpoints switch while a read is in flight no longer drops the steps that read brought back.
- `TraceRead` carries the trace's `cursor` after its entries, as `DevtoolsHistorySlice` does.
