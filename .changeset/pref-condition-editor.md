---
'@weasel-js/ui': patch
---

Adds API: `PrefConditionEditor`, a control that edits one `PrefCondition` against a schema, for a `showIf` or an `enableIf`. Each test is a row: the pref it reads, picked from the schema's leaves by name with the path beside it; a comparison; and a value. A boolean offers "is on" and "is off"; an enum offers "is", "is not", and "is one of", over that leaf's own options; a number offers "is above", "is at least", "is below", "is at most", "is", and "is not", with a number field; any other kind offers "is set". Two rows or more combine under "All of" or "Any of". A `not`, a combinator nested inside the top one, and a test with several operators are each drawn as a row of text, which can be removed and is otherwise handed back unchanged. What `checkPrefCondition` finds wrong with a row is said under that row. With its last row removed the condition is `undefined`, never `{ all: [] }`.
