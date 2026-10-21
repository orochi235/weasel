---
"@weasel-js/path-tools": patch
---

`cornerControlsState` reports a corner with no keyword (a parameter between them, or a sharp corner) as `shape: 'none'` rather than `null`. A prefs form now reads a `null` value as absent and shows the leaf's default, which would have pressed `round`; `'none'` is a held value the shape leaf's encoding reads as no option.
