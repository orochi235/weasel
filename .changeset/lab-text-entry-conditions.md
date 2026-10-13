---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

A list of plain text entries in a lab's control panel now disables each entry by the item's own `enableIf`, where that condition reads the entry (`{ from: 'item' }`), as `PrefsForm` and `SelectionPanel` already did. Additive: `@weasel-js/ui` exports `entriesDisabled` and `entryDisabledAt`, the two questions a surface asks about a list's entries.
