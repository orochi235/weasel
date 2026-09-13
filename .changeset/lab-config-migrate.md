---
"@weasel-js/labkit": patch
---

An instrument can move a stored config's values when its schema renames a key.
**`Instrument.migrateConfig(stored)`** runs on every stored config as a lab
loads — trials, saved snapshots, and records another tab writes — before the
instrument's defaults fill the gaps, so renaming `gridSize` to `grid.size` keeps
the value a user set rather than resetting it. It runs on configs already
moved, so it has to return a current one unchanged.
