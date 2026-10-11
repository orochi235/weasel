---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A condition over a boolean or an enum leaf stored through an `encoding` now compares the value its control shows, in every surface. `{ path: 'data.style.fontStyle', is: true }` holds while the Italic toggle is on, where it used to compare `true` against the stored `'italic'` and never hold; a test with no operator held for any stored string, `'normal'` included. A field of an `object` or a `union` leaf is read against that object, as its control reads it.

Breaking: `prefJudge` takes the schema first, `prefJudge(schema, read)`, and `read` still hands back stored values. Adds `prefShownReader(schema, read)`, the reader a judge compares through, and `prefShownValue(leaf, stored, siblings)`. `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` all judge through `prefJudge`. `checkPrefCondition` now rules out a comparison against an encoded leaf's stored form: for an encoded boolean anything but `true`, `false`, or `null`, and for an encoded enum anything but one of its options or `null`. labkit's `isEntryShown` is given no resolved schema and still compares stored values.
