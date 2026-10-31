---
"@weasel-js/ui": patch
---

- `Disclosure`'s twisty is filled with `--wzl-accent`, where it used `--wzl-accent-fg`, the accent meant for text.
- `FallthroughDiagram` names its "predicted" badge with a term, and explains the specificity tuple in the column header rather than in an `aria-label` that hid each cell's numbers.
- An `ItemList` grid gives every row a trailing cell once any row has one, so rows without controls no longer come up a column short.
- An unlocked padlock now shows on a hovered `LayerList` card, as it already did on a hovered row.
- `MenuButton` takes `buttonRef` for its trigger. `ListEditor` uses it, so removing the last entry from a list with several entry kinds moves focus to the add menu instead of dropping it.
- `KeymapHint` keeps its `role="status"` region mounted, empty, while no keymap is open, so a screen reader announces the keys when they appear.
- `MeasureReadout`'s values are no longer `<output>` elements, which made a screen reader announce every pointer move.
- `ShortcutKeys` sets its keys in `--wzl-font-ui` from its stylesheet instead of an inline `font-family`.
- `GradientEditor`'s handles draw their focus ring in `--wzl-focus-ring`, like the rest of the kit.
