---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`'s options editor flags an enum option whose stored value is empty or repeats an earlier row's: the value field takes the invalid state, with "Value is empty" or "Repeats an earlier value" under it. The edit is still taken and the export is unchanged, so a flagged row is exported as it stands.
