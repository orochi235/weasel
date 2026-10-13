---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Fixes: a tool hotkey fired while a `<select>` had focus, under the select's own type-ahead. The dispatcher now leaves a select its printable characters and its arrow, Home, End, and Page keys, and still takes Delete, Escape, and every modifier chord typed on one, so Cmd+Z works with focus resting on a select.

Changes behavior: `BandEditor` and `Timeline` asked their own question about a key's target, which counted a `<select>` as a text field. They now ask the dispatcher's, so Delete on a select inside a band merges the band, and Delete on a select inside a `Timeline` deletes the selected key. `x` and `l` on a select in a band are still the select's. This rule for `<select>` was chosen on an agent's judgment.

Adds API: `focusedControlOwnsKey(e)`, exported from `@weasel-js/gestures`, `@weasel-js/routing`, and `@weasel-js/core`: whether a key belongs to the control it was typed on. `isEditableTarget` and `activatesFocusedControl` now live in `@weasel-js/gestures` and are re-exported where they were.
