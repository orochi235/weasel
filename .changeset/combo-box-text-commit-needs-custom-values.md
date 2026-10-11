---
'@weasel-js/ui': patch
---

`ComboBox` called `onCommit` with `source: 'text'` for Enter on typed text even without `allowsCustomValue`, when the input then discards that text. A text commit is now reported only when `allowsCustomValue` is set, as the prop documents.
