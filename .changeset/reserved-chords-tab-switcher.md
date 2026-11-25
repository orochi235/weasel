---
'@weasel-js/routing': minor
---

`browserReservedChord` reports the tab and app switcher chords (Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+PageUp and PageDown, Cmd+Tab and Cmd+Alt+arrows on macOS, Alt+Tab elsewhere) and the Ctrl+Cmd chords macOS takes.

A `ReservedChord` can now name the Ctrl key itself with `ctrl`, and `platform: 'apple'` marks a chord taken only on Apple platforms.

<!-- entry: fix api -->
