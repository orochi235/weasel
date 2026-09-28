---
'@weasel-js/history': patch
'@weasel-js/core': patch
---

A `Journal` can now be observed and coalesces like its parent. It gains `subscribe` and `getVersion` (ready for `useSyncExternalStore`), which fire on every apply, undo, redo and coalesce inside the session and on each lifecycle transition, and `seal`, which ends a coalescing run as `History.seal` does. A journal now inherits its parent's `coalesceWindowMs`, clock and debug logger, so a session whose ops carry a `coalesceKey` merges rapid edits where it previously never did; pass `coalesceWindowMs: 0` to `beginJournal` to keep every push separate.

`HistoryEntry.pushes` says how many pushes an entry holds: 1 when pushed once, plus one for each push coalesced into it. It round-trips through `serialize`/`restore`; snapshots written before it read as 1.

The journals a `Scene` hands out forward all three new members.
