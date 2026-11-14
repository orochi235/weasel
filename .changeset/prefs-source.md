---
'@weasel-js/ui': minor
'@weasel-js/labkit': minor
---

New `PrefsSource`: where a params surface reads, writes, and resets its leaves, over a values map, a selection, or a lab config.

A `PrefsSource` answers `valueAt(path)`, `write(path, value, { draft })`, `update`, `autoAt`, `setAuto`, `stateAt(path)` (`enableIf`, `showIf`, `activeIf`), and `reset(paths)`. Build one with `useValuesSource(schema, values, onChange, options)`, `useSelectionSource(...)`, or labkit's `useLabConfigSource(...)`, and hand it down with `<PrefsSource source>` and `usePrefsSource()`.

<!-- entry: api new -->
