---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A list of plain text in `SelectionPanel` is drawn with `ListEditor`'s own fields, as `PrefsForm` and labkit's `ControlPanel` draw one, so Enter adds an entry and Backspace removes an empty one there too. Which lists those are is one exported test, `prefListIsText`, with `prefListTexts` for their entries.
