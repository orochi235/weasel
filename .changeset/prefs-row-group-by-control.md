---
'@weasel-js/ui': patch
---

`PrefsForm`: a row is drawn as a group, not a `<label>`, whenever `PropertyField` would draw it as one: an enum with `control: 'radio'`, `'toggle'`, or `'menu'`, a boolean with `'switch'` or `'toggle'`, and a paint leaf, in a row of their own and as a field of an object leaf. A click on such a row's name used to write the first option, and each radio's accessible name carried the row's label.
