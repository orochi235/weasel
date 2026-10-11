---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

`checkPrefCondition` reports an `in` of no values, which never holds, under the new code `never`. `PrefConditionEditor` says so on a row whose "is one of" has every option unchecked, and `PrefSchemaEditor` marks that node's row in the structure tree.
