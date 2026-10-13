---
'@weasel-js/ui': patch
---

`PrefConditionEditor` has Copy and Paste on its first line. Copy puts the whole condition on the system clipboard as JSON; Paste replaces the condition with one read from there, which is how a `showIf` or an `enableIf` gets from one pref to another. A pasted test that reads a pref the schema lacks says so on its row, and a clipboard that holds no condition changes nothing and says so. Neither button is drawn on a page with no clipboard.
