---
"@weasel-js/ui": patch
---

A focused segment of `ToggleBar`, `ButtonBar` or `OptionsBar` now shows its focus ring when it is the selected one, drawn in `--wzl-focus-ring` (on-accent where the segment is accent-filled).
`ToolButton` draws its focus ring in `--wzl-focus-ring`, outside the button, so it no longer looks like the active state; the slider thumb's ring uses the same token.
A `ToolButton`'s accessible name no longer includes its shortcut chip; the tooltip still shows it.
`ToolPalette` sets `aria-orientation` on its toolbar from `orientation`, and leaves it off when `columns` lays it out as a grid.
A small curved segmented row honors `--tb-h`, as the straight one does.
`Tree` rows, vertical `Tabs`, segmented-row end corners, `StatusBar` dividers and spacer, the `Toast` accent edge, `ToolButton`'s menu mark and `SidebarPanel`'s title follow the writing direction, so they mirror under `dir="rtl"`.
`TabList` forwards its `ref` under React 18 as well as 19, so `PageTabs` gets its list element there too.
`Toolbar.Button` with `iconOnly` now requires a `title` or an `aria-label` at the type level, where it rendered `aria-label=""`.
A hovered `Tree` row is drawn in `--wzl-surface-hover`, where it used `--wzl-surface` and could not be seen on a surface panel.
