---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

A `showIf` on a list's or a map's `item` is now a bad condition: `checkPrefConditions` reports it with the new code `item-show` and says where the condition belongs, on the entry's fields or on the list. An item is drawn with each entry and was never hidden, so the condition did nothing before and was not mentioned. `enableIf` on an item is still read. A store warns of it when it opens, labkit's `resolveConfigSchema` throws on it, and `PrefSchemaEditor` marks the list's row.

Adds API: `checkPrefCondition` takes a third argument, a `PrefConditionSite` saying where the condition's node sits: `within`, the list or map it is inside an entry of, and `itemShowIf`.
