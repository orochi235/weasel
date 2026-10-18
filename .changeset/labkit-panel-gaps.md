---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

Fixes for gaps found moving an app's controls onto labkit's `ControlPanel` and `f`.

- `ThemeProvider` takes `selection={{ mode: 'auto' }}` and follows the OS setting, live. Any other axis value the theme lacks still falls back to the axis default, now with a warning in development.
- `ControlPanel` and `ControlMatrix` set their own text color, the theme's `--wzl-fg`, so a light page no longer puts dark text on a dark panel.
- An `f.action`'s run is told the drawing panel's `config` and `setConfig` beside its `path` (`ConfigActionContext`).
- `ControlPanel` takes `changed`, the same set of paths `PrefsForm` takes, and marks those rows as changed. `PropertyField` and `DialogRow` take `changed` as `PropertyRow` does.
- Breaking: auto is opt-in. A leaf's label toggles auto only when the leaf says `.auto()` (with or without a resolver) or `.initial(auto)`. `.manual()` is gone; a leaf that never says auto is always pinned.
- A renderer's context carries `values`, the whole config or form values, and `changed` for its row, in `ControlPanel` and `PrefsForm` alike. `PrefControl` takes `values` to pass on.
- `ControlMatrix`: a row's `summary` says what its cells show, falling back to the leaf's `.dialog` summary; `inherit={false}` makes a plain grid with no fallback column, and `auto` is optional.
- `ListEditor` reorders with `reorder`: a handle to drag on each entry, and Alt+Up / Alt+Down anywhere in one. `newEntry` takes a list of `{ label, make }` kinds, which makes the add button a menu.
- `EasingPicker` takes `label`, `false` for none, and draws none of its own inside a `PropertyRow`, taking the row's label as its menu's name.
- In a paired grid, a row a renderer draws and a group drawn `as('bar')` take the whole width.
