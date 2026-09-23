---
'@weasel-js/ui': patch
---

`ItemList` is now an accessible list rather than a column of plain divs. Its role follows what the list can do: a `list` when rows can be neither selected nor activated, a `listbox` of `option`s with `aria-selected` when `selection` is `'single'` or `'multi'`, and a `grid` when any row carries `trailing` controls (visibility, lock), since an option may not contain controls. One row sits in the tab order; Up/Down and Home/End move between rows, Enter/Space and click call the new `onActivate(id, index, mods)` with the modifiers held, and Alt+Up/Down call the new `onNudge(id, index, delta)`, which takes `useReorderDragList`'s `nudge` as-is. In a grid, Right steps into a row's controls and Left or Escape steps back; a control's own clicks and keys never activate its row. `PressModifiers` is now exported.
