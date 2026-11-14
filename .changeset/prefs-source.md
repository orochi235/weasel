---
'@weasel-js/ui': minor
'@weasel-js/labkit': minor
---

New `@weasel-js/ui/components/PrefsSource`: one interface for where a params surface reads, writes, and resets its leaves, with sources over a values map, a node selection, and a lab's config.

A `PrefsSource` answers `valueAt(path)`, `write(path, value, { draft })`, `update`, `autoAt`, `setAuto`, `stateAt(path)` (`enableIf`, `showIf`, `activeIf`), and `reset(paths)`. Build one with `useValuesSource(schema, values, onChange, options)`, `useSelectionSource(...)`, or labkit's `useLabConfigSource(...)`, and hand it down with `<PrefsSource source>` and `usePrefsSource()`.

<!-- entry: api new -->
