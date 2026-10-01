---
'@weasel-js/ui': patch
---

A slider whose caller takes settled values only — a no-op `onInput` beside `onChange`, as `PropertyNumberFieldProps` documents — now follows the drag and commits where it stopped. It used to snap back on every move and commit its starting value, because the track stayed controlled by a `value` that the caller never updated mid-drag. `PropertyField` and `PropertyControl` hold the drag locally until the commit. This fixes every bounded number slider in `Prefs`, `PrefsForm` and `PrefsDialog`.
