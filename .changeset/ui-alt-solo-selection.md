---
'@weasel-js/ui': minor
---

An Alt-click on a `ToggleChips` chip or a `'multiple'` or `'each'` `SegmentedBar` segment solos it, and an Alt-drag solos every one it reaches.

Soloing turns that item on and every other one off, or, when that already holds, turns them all back on. Alt+Space and Alt+Enter solo the focused item. With `sweep`, a drag pressed with Alt turns on the items it has reached and every other one off; Escape puts them back. Disabled items are left as they are, and a mixed one counts as off. `useRovingTabIndex`'s `onActivate` now also receives the keypress.

<!-- entry: rank=5 new behavior api -->
