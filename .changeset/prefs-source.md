---
'@weasel-js/prefs': minor
'@weasel-js/ui': minor
'@weasel-js/labkit': minor
---

New `PrefsSource`: where a params surface reads, writes, and resets its leaves, over a values map, a selection, or a lab config.

A `PrefsSource` (`@weasel-js/prefs`) answers `valueAt(path)`, `write(path, value, { draft })`, `update`, `autoAt`, `setAuto`, `stateAt(path)` (`enableIf`, `showIf`, `activeIf`), and `reset(paths)`. It needs no React, so a DOM host builds one with prefs' `createValuesSource(schema, get, set, options)`, which reads the values through `get` each time, or `createSelectionSource({ leaves, read, write, reset })` over any set of targets, or `createRecordSource` over values keyed by whole dotted paths. `sourceResetPlan`, `sourceIsAtReset`, and `leafAtReset` answer what a reset does over one.

In React, `useValuesSource(schema, values, onChange, options)`, `useSelectionSource(input)`, and labkit's `useLabConfigSource(...)` build one (labkit's plain factory is `createLabConfigSource`), and ui's `<PrefsSource source>` and `usePrefsSource()` hand it down.

<!-- entry: api new -->
