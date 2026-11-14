---
'@weasel-js/ui': minor
---

ui exports the pieces its schema editor used from inside it, for an editor built outside ui.

`renderPrefControl` draws a leaf's control through a renderer map, `actionShortcutText` and `useBarMenuResolver` give an action's shortcut text and a bar menu's entries, `pathWithin` says whether one dotted path lies under another, `heirOf` names the row that takes focus when one goes, `byRank` orders items by a list of keys, `swallowNextClick` drops the click a drag's release would send, and `MIXED_HINT` and `MARK_GROUP` name the mixed-value placeholder and the marks' icon group. `HISTORY_COALESCE_MS` is `history.coalesceMs`'s default, in `@weasel-js/ui/kit-settings` too.

<!-- entry: api -->
