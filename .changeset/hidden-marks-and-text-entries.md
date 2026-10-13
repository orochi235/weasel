---
'@weasel-js/ui': patch
---

Fixes, under `markHidden`: the rail entry of a page or section a `showIf` hides is dimmed and carries the `hidden` badge, a hidden cell of a bar carries the badge beside its control in `PrefsForm` and in a `SelectionPanel` section drawn `as: 'bar'`, and the badge wraps under a name it does not fit beside. In a `SelectionPanel` row the badge ran over the field: the name and the badge were one unbreakable word in a 64px label column.

Adds API: `ListEditor` takes `entryDisabled`, a function from an entry's index to whether its text field takes no typing. A disabled entry can still be removed. `PrefsForm` and `SelectionPanel` pass it for a list of plain text entries, so an item `enableIf` that reads the entry (`{ from: 'item', path: '' }`) disables that entry alone, where it did nothing.
