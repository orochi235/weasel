---
'@weasel-js/labkit': patch
---

Every trial has undo and redo unless its instrument opts out: an instrument that declares no `undo` gets the buttons and Mod+Z. `undo: false` turns them off, and an instrument with `annotations` still gets them for its marks.

Undo now steps a trial's settings along with its state. An undo entry used to hold only `state`, so undoing a settings change put back what `onConfigChange` had derived and left the setting itself changed; it now restores both. A trial snapshots on `state.change` and `config.change` unless its instrument names other events, where it used to snapshot on `state.change` alone.
