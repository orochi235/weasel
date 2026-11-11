---
"@weasel-js/labkit": patch
---

A trial's Undo and Redo survive a reload.

The trial's history is saved in its record, beside the state it undoes, and restored when the trial mounts, with each step's state put through the instrument's `serialize` and `deserialize`; another tab's write to a trial brings that tab's history with it. Reset and loading a snapshot clear the saved history, as they clear the live one. A step that cannot be saved, such as a write to the lab's `over` values, is left out of the saved history along with every step before it. Stored labs move to document version 5; a version-4 record opens with nothing to undo. `TrialRecord` gains `undo`, the history its record was read with.

<!-- entry: rank=10 new data api -->
